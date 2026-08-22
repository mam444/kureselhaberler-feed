// One-off backfill: articles published before the stricter 350-word floor
// was added to the Gemini prompt (see gemini.mjs rule 3) are often much
// shorter than a real news article. Re-runs each one through the now-
// stricter prompt, feeding its own existing (already-rewritten, already
// fact-checked-against-source) headline/body back in as the source
// material to expand — no re-fetch from the original RSS/publisher needed,
// and the no-fabrication rule still applies, so this only adds legitimate
// journalistic context, never new facts.
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { rewriteArticle } from './gemini.mjs';

const FEED_PATH = path.resolve('docs/haberler.json');
const MIN_WORDS = 320; // slightly under the 350 floor — only touch genuinely-short ones
const MAX_BACKFILL = Number(process.env.BACKFILL_MAX ?? 60);
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const wordCount = (text) => (text ? text.trim().split(/\s+/).filter(Boolean).length : 0);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  if (!GEMINI_API_KEY) {
    console.log('[backfill-lengthen] GEMINI_API_KEY tanımlı değil, çıkılıyor.');
    return;
  }
  const raw = await readFile(FEED_PATH, 'utf8');
  const data = JSON.parse(raw);
  const articles = data.articles ?? [];

  const short = articles
    .filter((a) => a.body && wordCount(a.body) < MIN_WORDS)
    .sort((a, b) => wordCount(a.body) - wordCount(b.body)) // shortest (worst) first
    .slice(0, MAX_BACKFILL);

  console.log(
    `[backfill-lengthen] ${articles.length} makaleden ${short.length} tanesi ${MIN_WORDS} kelimenin altında (üst sınır ${MAX_BACKFILL}, bu turda işlenecek).`,
  );

  let updated = 0;
  for (const article of short) {
    const before = wordCount(article.body);
    try {
      const rewritten = await rewriteArticle(
        { headline: article.headline, body: article.body, category: article.category },
        GEMINI_API_KEY,
      );
      const after = wordCount(rewritten.body);
      if (after > before) {
        article.headline = rewritten.headline || article.headline;
        article.body = rewritten.body;
        if (rewritten.highlights?.length) article.highlights = rewritten.highlights;
        updated++;
        console.log(`[backfill-lengthen] "${article.headline.slice(0, 50)}" ${before} -> ${after} kelime`);
      } else {
        console.warn(`[backfill-lengthen] "${article.headline.slice(0, 50)}" uzamadı (${before} -> ${after}), atlanıyor.`);
      }
    } catch (err) {
      console.warn(`[backfill-lengthen] "${article.headline}" başarısız: ${err.message}`);
    }
    // Free-tier is 10 req/min — stay comfortably under that between calls.
    await sleep(7000);
  }

  await writeFile(FEED_PATH, JSON.stringify(data, null, 2), 'utf8');
  console.log(`[backfill-lengthen] tamam — ${updated}/${short.length} makale uzatıldı.`);
}

main().catch((err) => {
  console.error('[backfill-lengthen] beklenmeyen hata:', err);
  process.exitCode = 1;
});
