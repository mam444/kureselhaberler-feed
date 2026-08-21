import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { ALL_SOURCES } from './sources.mjs';
import { fetchAllSources } from './fetch-rss.mjs';
import { rewriteArticle } from './groq.mjs';
import { findPhoto } from './unsplash.mjs';
import { sendNewArticleNotification } from './onesignal.mjs';
import { jaccardSimilarity } from './similarity.mjs';

const FEED_PATH = path.resolve('docs/haberler.json');
// NTV tarzı uzun makaleler artık başına 2800 token'a kadar harcayabiliyor
// (öncesi 1050'ydi) — Groq ücretsiz kademenin günlük 200.000 token
// sınırını daha hızlı tüketmemek için çalıştırma başına işlenen yeni haber
// sayısı düşürüldü; böylece bütçe günün daha büyük bölümüne yayılıyor.
const MAX_NEW_PER_RUN = 5;
const MAX_TOTAL_ARTICLES = 300;
// Groq çıktısı kaynağa bu eşiğin üzerinde benzerse "yeterince yeniden
// yazılmadı" kabul edilip yayınlanmaz (bir sonraki çalıştırmada tekrar denenir).
const MAX_ALLOWED_SIMILARITY = 0.5;

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;
const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY;

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
    const rewritten = await rewriteArticle(
      { headline: raw.headline, body: raw.body, category: raw.category },
      GROQ_API_KEY,
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

    const photo = await findPhoto(
      [rewritten.imageKeyword, raw.category, 'news', 'newspaper'],
      UNSPLASH_ACCESS_KEY,
    );

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
    console.warn(`[groq] "${raw.headline}" yeniden yazılamadı: ${err.message}`);
    return null;
  }
}

async function main() {
  if (!GROQ_API_KEY) {
    console.log('[main] GROQ_API_KEY tanımlı değil — RSS çekilecek ama hiçbir haber yeniden yazılmayacak.');
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

  const brandNewRaw = deduped.filter((a) => !previousIds.has(a.id)).slice(0, MAX_NEW_PER_RUN);
  console.log(`[main] ${brandNewRaw.length} yeni haber işlenecek (bu çalıştırmada, üst sınır ${MAX_NEW_PER_RUN}).`);

  // Sıralı işlenir (paralel değil): artık daha uzun/tam metinler ürettiğimiz
  // için Groq'un ücretsiz kademe dakikalık token limitine (TPM) paralel
  // isteklerle çok hızlı takılıyorduk.
  const rewritten = [];
  if (GROQ_API_KEY) {
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
    await sendNewArticleNotification(mostRecent, {
      appId: ONESIGNAL_APP_ID,
      restApiKey: ONESIGNAL_REST_API_KEY,
    });
  }
}

main().catch((err) => {
  console.error('[main] beklenmeyen hata:', err);
  process.exitCode = 1;
});
