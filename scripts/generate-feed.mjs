import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { ALL_SOURCES } from './sources.mjs';
import { fetchAllSources } from './fetch-rss.mjs';
import { rewriteArticle } from './gemini.mjs';
import { findPhoto } from './unsplash.mjs';
import { sendNewArticleNotification } from './onesignal.mjs';
import { fcmTopicForCategory, sendAndroidPush } from './fcm.mjs';
import { jaccardSimilarity } from './similarity.mjs';
import { decodeHtmlEntities } from './html-text.mjs';

const FEED_PATH = path.resolve('docs/haberler.json');
// The feed runs every ten minutes. Publish up to six fresh items per run while
// keeping Gemini usage at two rewrites; the remaining slots use a short,
// verified publisher RSS summary. This broadens coverage without increasing
// Gemini calls. Gemini's active limits vary by project/model and are checked
// in AI Studio; the verified-RSS fallback keeps articles flowing on errors.
const MAX_NEW_PER_RUN = 6;
const MAX_GEMINI_REWRITES_PER_RUN = 2;
const MAX_TOTAL_ARTICLES = 600;
// Keep a useful recent archive for browsing older stories, but never let a
// stale RSS backlog (or a publisher's ancient archive item) masquerade as
// current news in the app or on the website.
const MAX_ARTICLE_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_REJECTED_IDS = 2_000;
const MAX_SOURCE_SUMMARY_CHARS = 1600;
// Headlines alone do not contain enough evidence for a reliable article.
const MIN_SOURCE_SUMMARY_CHARS = 100;
// Gemini çıktısı kaynağa bu eşiğin üzerinde benzerse "yeterince yeniden
// yazılmadı" kabul edilip yayınlanmaz (bir sonraki çalıştırmada tekrar denenir).
const MAX_ALLOWED_SIMILARITY = 0.5;
const MAX_FUTURE_SKEW_MS = 5 * 60_000;
const RSS_FALLBACK_MAX_CHARS = 420;

function isWithinNewsWindow(article, now = Date.now()) {
  const publishedAt = Date.parse(article.publishedAt ?? '');
  return Number.isFinite(publishedAt)
    && publishedAt >= now - MAX_ARTICLE_AGE_MS
    && publishedAt <= now + MAX_FUTURE_SKEW_MS;
}

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;
const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY;
const FCM_ACCESS_TOKEN = process.env.FCM_ACCESS_TOKEN;
const FCM_PROJECT_ID = process.env.FCM_PROJECT_ID;

function timeAgoTrSnapshot(iso) {
  if (!iso) return 'şimdi';
  const diffMin = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (diffMin < 1) return 'şimdi';
  if (diffMin < 60) return `${diffMin} dk önce`;
  const diffHour = Math.round(diffMin / 60);
  if (diffHour < 24) return `${diffHour} sa önce`;
  return `${Math.round(diffHour / 24)} gün önce`;
}

async function loadPreviousFeed() {
  try {
    const raw = await readFile(FEED_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      articles: Array.isArray(parsed.articles) ? parsed.articles : [],
      rejectedIds: Array.isArray(parsed.rejectedIds) ? parsed.rejectedIds : [],
    };
  } catch {
    return { articles: [], rejectedIds: [] };
  }
}

async function rewriteAndIllustrate(raw) {
  try {
    const completeSummary = String(raw.body ?? '').trim();
    const sourceSummary = completeSummary.length <= MAX_SOURCE_SUMMARY_CHARS
      ? completeSummary
      : completeSummary.slice(0, MAX_SOURCE_SUMMARY_CHARS).replace(/\s+\S*$/, '').trim();
    if (sourceSummary.length < MIN_SOURCE_SUMMARY_CHARS) {
      console.warn(
        `[guard] "${raw.headline}" kaynak özeti yetersiz (${sourceSummary.length} karakter); haber uydurmamak için atlandı.`,
      );
      return { article: null, permanentlyRejected: true };
    }

    const rewritten = await rewriteArticle(
      { headline: raw.headline, body: sourceSummary, category: raw.category },
      GEMINI_API_KEY,
    );
    const sourceText = `${raw.headline} ${raw.body ?? ''}`;
    const rewrittenText = `${rewritten.headline} ${rewritten.body}`;
    const similarity = jaccardSimilarity(sourceText, rewrittenText);
    if (similarity > MAX_ALLOWED_SIMILARITY) {
      console.warn(
        `[guard] "${raw.headline}" kaynağa çok benziyor (${similarity.toFixed(2)}), bu turda yayınlanmıyor.`,
      );
      return { article: null, permanentlyRejected: true };
    }

    const photo = rewritten.imageKeyword
      ? await findPhoto(
          [rewritten.imageKeyword, raw.category, 'news'],
          UNSPLASH_ACCESS_KEY,
        )
      : null;

    return {
      article: {
        id: raw.id,
        headline: rewritten.headline,
        source: raw.source,
        sourceIconUrl: raw.sourceIconUrl,
        imageUrl: photo?.imageUrl ?? null,
        imageCredit: photo?.imageCredit ?? null,
        timeAgo: timeAgoTrSnapshot(raw.publishedAt),
        body: rewritten.body,
        highlights: rewritten.highlights ?? [],
        externalUrl: raw.externalUrl,
        publishedAt: raw.publishedAt,
        category: raw.lang === 'en' && raw.category === 'World'
          ? 'Dünya'
          : raw.category,
        // Gemini's editorial prompt always produces Turkish, even when its
        // source item comes from an English-language international feed.
        lang: 'tr',
      },
      permanentlyRejected: false,
    };
  } catch (err) {
    console.warn(`[gemini] "${raw.headline}" yeniden yazılamadı: ${err.message}`);
    return {
      article: null,
      permanentlyRejected: false,
      dailyQuotaExceeded: err.code === 'GEMINI_DAILY_QUOTA_EXCEEDED',
    };
  }
}

function createRssFallback(raw) {
  const summary = String(raw.body ?? '').trim();
  if (summary.length < MIN_SOURCE_SUMMARY_CHARS) {
    console.warn(`[fallback] "${raw.headline}" RSS özeti yetersiz; içerik uydurmamak için atlandı.`);
    return null;
  }
  const excerpt = summary.length <= RSS_FALLBACK_MAX_CHARS
    ? summary
    : `${summary.slice(0, RSS_FALLBACK_MAX_CHARS).replace(/\s+\S*$/, '').trim()}…`;
  return {
    id: raw.id,
    headline: raw.headline,
    source: raw.source,
    sourceIconUrl: raw.sourceIconUrl,
    imageUrl: null,
    imageCredit: null,
    timeAgo: timeAgoTrSnapshot(raw.publishedAt),
    body: excerpt,
    highlights: [],
    externalUrl: raw.externalUrl,
    publishedAt: raw.publishedAt,
    category: raw.category,
    lang: raw.lang,
  };
}

async function main() {
  if (!GEMINI_API_KEY) {
    console.log('[main] GEMINI_API_KEY tanımlı değil — uygun RSS haberleri kısa kaynak özetiyle yayınlanacak.');
  }

  console.log(`[main] ${ALL_SOURCES.length} kaynak taranıyor...`);
  const fetched = await fetchAllSources(ALL_SOURCES);

  const seenIds = new Set();
  const deduped = [];
  for (const a of fetched) {
    if (a.id && !seenIds.has(a.id)) {
      seenIds.add(a.id);
      deduped.push(a);
    }
  }
  deduped.sort((a, b) => new Date(b.publishedAt ?? 0) - new Date(a.publishedAt ?? 0));
  const now = Date.now();
  const futureArticles = deduped.filter((article) => {
    const publishedAt = Date.parse(article.publishedAt ?? '');
    return Number.isFinite(publishedAt) && publishedAt > now + MAX_FUTURE_SKEW_MS;
  });
  if (futureArticles.length > 0) {
    console.warn(`[guard] ${futureArticles.length} haberin yayın zamanı gelecekte; doğrulanana kadar akıştan çıkarıldı.`);
  }
  const publishable = deduped.filter((article) => isWithinNewsWindow(article, now));
  const expiredCount = deduped.length - publishable.length;
  if (expiredCount > 0) {
    console.log(`[guard] ${expiredCount} haber tarih bilgisi eksik, 7 günden eski veya gelecekte olduğu için akışa alınmadı.`);
  }
  console.log(`[main] ${deduped.length} benzersiz ham haber bulundu.`);

  const previousFeed = await loadPreviousFeed();
  const previous = previousFeed.articles.filter((article) => isWithinNewsWindow(article, now));
  const previousIds = new Set(previous.map((a) => a.id));
  const rejectedIds = new Set(previousFeed.rejectedIds);

  const unseen = publishable.filter(
    (a) => !previousIds.has(a.id) && !rejectedIds.has(a.id),
  );

  // A single fast-refreshing (or always-recent-pubDate) source can otherwise
  // fill every slot on every run and starve every other outlet out
  // indefinitely — round-robin one pick per source instead of a flat "most
  // recent overall" cut, so every source (including the international/world
  // ones) gets a fair turn each run rather than one feed monopolizing it.
  const bySource = new Map();
  for (const a of unseen) {
    if (!bySource.has(a.source)) bySource.set(a.source, []);
    bySource.get(a.source).push(a); // already newest-first, from `deduped`'s sort
  }
  const brandNewRaw = [];
  for (let addedInRound = true; brandNewRaw.length < MAX_NEW_PER_RUN && addedInRound; ) {
    addedInRound = false;
    for (const list of bySource.values()) {
      if (brandNewRaw.length >= MAX_NEW_PER_RUN) break;
      if (list.length > 0) {
        brandNewRaw.push(list.shift());
        addedInRound = true;
      }
    }
  }
  console.log(`[main] ${brandNewRaw.length} yeni haber işlenecek (bu çalıştırmada, üst sınır ${MAX_NEW_PER_RUN}, ${bySource.size} kaynaktan).`);

  // Sıralı işlenir (paralel değil): dakikalık istek/token limitine paralel
  // isteklerle takılmamak için.
  const rewritten = [];
  const permanentlyRejected = [];
  let dailyGeminiQuotaExceeded = !GEMINI_API_KEY;
  let geminiRewriteCount = 0;
  for (const raw of brandNewRaw) {
    if (
      dailyGeminiQuotaExceeded ||
      geminiRewriteCount >= MAX_GEMINI_REWRITES_PER_RUN
    ) {
      const fallback = createRssFallback(raw);
      if (fallback) rewritten.push(fallback);
      continue;
    }
    geminiRewriteCount++;
    const result = await rewriteAndIllustrate(raw);
    if (result.article) rewritten.push(result.article);
    else if (result.dailyQuotaExceeded) {
      dailyGeminiQuotaExceeded = true;
      const fallback = createRssFallback(raw);
      if (fallback) rewritten.push(fallback);
      console.warn('[fallback] Gemini günlük kotası dolu; kalan haberlerde yalnızca doğrulanmış RSS başlığı ve kısa özeti kullanılacak.');
    } else if (result.permanentlyRejected) {
      // If Gemini's rewrite is too close to its source, retain the verified
      // publisher summary instead of discarding a valid fresh report.
      const fallback = createRssFallback(raw);
      if (fallback) rewritten.push(fallback);
      else permanentlyRejected.push(raw.id);
    } else {
      // A transient Gemini/photo error should not make a fresh story wait for
      // another ten-minute cycle when the publisher already supplied a summary.
      const fallback = createRssFallback(raw);
      if (fallback) rewritten.push(fallback);
    }
  }

  const merged = [...rewritten, ...previous]
    .map((article) => {
      // Historical Gemini translations were incorrectly tagged with their
      // publisher's source language and English world category. The app
      // filters by display language/category, so expose them as Turkish news.
      const wasTranslatedToTurkish = article.lang === 'en'
        && (Boolean(article.imageUrl)
          || (Array.isArray(article.highlights) && article.highlights.length > 0));
      return {
        ...article,
        headline: decodeHtmlEntities(article.headline),
        body: article.body ? decodeHtmlEntities(article.body) : article.body,
        lang: wasTranslatedToTurkish ? 'tr' : article.lang,
        category: wasTranslatedToTurkish && article.category === 'World'
          ? 'Dünya'
          : article.category,
      };
    })
    .filter((article) => isWithinNewsWindow(article, now))
    .filter((a, i, arr) => arr.findIndex((b) => b.id === a.id) === i)
    .sort((a, b) => new Date(b.publishedAt ?? 0) - new Date(a.publishedAt ?? 0))
    .slice(0, MAX_TOTAL_ARTICLES);

  await mkdir(path.dirname(FEED_PATH), { recursive: true });
  await writeFile(
    FEED_PATH,
    JSON.stringify({
      generatedAt: new Date().toISOString(),
      articles: merged,
      // Remember only permanent quality rejections. Transient Gemini/photo
      // errors stay eligible for a later retry. This keeps the same short or
      // duplicate RSS items from starving newer articles on every 10-minute run.
      rejectedIds: [...rejectedIds, ...permanentlyRejected].slice(-MAX_REJECTED_IDS),
    }, null, 2),
    'utf8',
  );
  console.log(`[main] docs/haberler.json yazıldı — toplam ${merged.length} haber (${rewritten.length} yeni, ${permanentlyRejected.length} kalite filtresi).`);

  if (rewritten.length > 0) {
    // The mobile push topics are shared across locale settings. Send only
    // Turkish output there, so an untranslated English RSS fallback never
    // appears as a Turkish notification on the default app audience.
    const notificationArticles = rewritten.filter((article) => article.lang === 'tr');
    const androidPushes = [
      // One global-topic alert per story. Readers who follow categories are
      // unsubscribed from the global topic by the app and receive only the
      // relevant category alerts below.
      ...notificationArticles.map((article) =>
        sendAndroidPush(article, FCM_ACCESS_TOKEN, FCM_PROJECT_ID),
      ),
      ...notificationArticles.flatMap((article) => {
        const topic = fcmTopicForCategory(article.category);
        return topic
          ? [sendAndroidPush(article, FCM_ACCESS_TOKEN, FCM_PROJECT_ID, topic)]
          : [];
      }),
    ];
    const sends = await Promise.allSettled([
      ...androidPushes,
      ...notificationArticles.map((article) =>
        sendNewArticleNotification(article, {
          appId: ONESIGNAL_APP_ID,
          restApiKey: ONESIGNAL_REST_API_KEY,
          includeAndroid: !FCM_ACCESS_TOKEN || !FCM_PROJECT_ID,
        }),
      ),
    ]);
    const androidFailures = sends.slice(0, androidPushes.length)
      .filter((result) => result.status === 'rejected');
    if (androidFailures.length > 0) {
      // Don't let the workflow commit this story as processed when Android
      // push failed. The next scheduled run can retry it instead of silently
      // losing the alert after the feed has advanced.
      throw new Error(
        `Android bildirimi gönderilemedi: ${androidFailures.map((failure) => failure.reason?.message ?? failure.reason).join('; ')}`,
      );
    }
    const oneSignalFailures = sends.slice(androidPushes.length)
      .filter((result) => result.status === 'rejected');
    if (oneSignalFailures.length > 0) {
      console.warn(
        `[onesignal] ${oneSignalFailures.length} bildirim sağlayıcısı hatası:`,
        oneSignalFailures.map((failure) => failure.reason?.message ?? failure.reason).join('; '),
      );
    }
  }
}

main().catch((err) => {
  console.error('[main] beklenmeyen hata:', err);
  process.exitCode = 1;
});
