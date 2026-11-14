import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { ALL_SOURCES } from './sources.mjs';
import { fetchAllSources } from './fetch-rss.mjs';
import { rewriteArticle } from './gemini.mjs';
import { findPhoto } from './unsplash.mjs';
import { sendNewArticleNotification } from './onesignal.mjs';
import { sendAndroidPush } from './fcm.mjs';
import { jaccardSimilarity } from './similarity.mjs';

const FEED_PATH = path.resolve('docs/haberler.json');
const MAX_NEW_PER_RUN = 10;
const MAX_TOTAL_ARTICLES = 300;
// Headlines alone do not contain enough evidence for a reliable article.
const MIN_SOURCE_SUMMARY_CHARS = 100;
// Gemini çıktısı kaynağa bu eşiğin üzerinde benzerse "yeterince yeniden
// yazılmadı" kabul edilip yayınlanmaz (bir sonraki çalıştırmada tekrar denenir).
const MAX_ALLOWED_SIMILARITY = 0.5;

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
    return Array.isArray(parsed.articles) ? parsed.articles : [];
  } catch {
    return [];
  }
}

async function rewriteAndIllustrate(raw) {
  try {
    const sourceSummary = String(raw.body ?? '').trim();
    if (sourceSummary.length < MIN_SOURCE_SUMMARY_CHARS) {
      console.warn(
        `[guard] "${raw.headline}" kaynak özeti yetersiz (${sourceSummary.length} karakter); haber uydurmamak için atlandı.`,
      );
      return null;
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
      return null;
    }

    const photo = rewritten.imageKeyword
      ? await findPhoto(
          [rewritten.imageKeyword, raw.category, 'news'],
          UNSPLASH_ACCESS_KEY,
        )
      : null;

    return {
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
      category: raw.category,
      lang: raw.lang,
    };
  } catch (err) {
    console.warn(`[gemini] "${raw.headline}" yeniden yazılamadı: ${err.message}`);
    return null;
  }
}

async function main() {
  if (!GEMINI_API_KEY) {
    console.log('[main] GEMINI_API_KEY tanımlı değil — RSS çekilecek ama hiçbir haber yeniden yazılmayacak.');
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
  console.log(`[main] ${deduped.length} benzersiz ham haber bulundu.`);

  const previous = await loadPreviousFeed();
  const previousIds = new Set(previous.map((a) => a.id));

  const unseen = deduped.filter((a) => !previousIds.has(a.id));

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
  if (GEMINI_API_KEY) {
    for (const raw of brandNewRaw) {
      const article = await rewriteAndIllustrate(raw);
      if (article) rewritten.push(article);
    }
  }

  const merged = [...rewritten, ...previous]
    .filter((a, i, arr) => arr.findIndex((b) => b.id === a.id) === i)
    .sort((a, b) => new Date(b.publishedAt ?? 0) - new Date(a.publishedAt ?? 0))
    .slice(0, MAX_TOTAL_ARTICLES);

  await mkdir(path.dirname(FEED_PATH), { recursive: true });
  await writeFile(
    FEED_PATH,
    JSON.stringify({ generatedAt: new Date().toISOString(), articles: merged }, null, 2),
    'utf8',
  );
  console.log(`[main] docs/haberler.json yazıldı — toplam ${merged.length} haber (${rewritten.length} yeni).`);

  if (rewritten.length > 0) {
    const mostRecent = rewritten.reduce((best, a) =>
      new Date(a.publishedAt ?? 0) > new Date(best.publishedAt ?? 0) ? a : best,
    );
    const sends = await Promise.allSettled([
      sendAndroidPush(mostRecent, FCM_ACCESS_TOKEN, FCM_PROJECT_ID),
      sendNewArticleNotification(mostRecent, {
        appId: ONESIGNAL_APP_ID,
        restApiKey: ONESIGNAL_REST_API_KEY,
        includeAndroid: !FCM_ACCESS_TOKEN || !FCM_PROJECT_ID,
      }),
    ]);
    for (const result of sends) {
      if (result.status === 'rejected') {
        console.warn('[push] bildirim sağlayıcısı hatası:', result.reason?.message ?? result.reason);
      }
    }
  }
}

main().catch((err) => {
  console.error('[main] beklenmeyen hata:', err);
  process.exitCode = 1;
});
