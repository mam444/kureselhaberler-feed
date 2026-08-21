// One-off backfill: existing articles published before the "highlights"
// field existed have no AI-summary bullets. Rather than leaving the
// (many) already-published articles without the new "AI Özeti" box until
// they naturally scroll out of the 300-article window, this generates
// highlights for the most recent N missing ones from their already-final
// body text (no re-rewrite, no Unsplash/similarity-guard involvement).
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { generateHighlights } from './gemini.mjs';

const FEED_PATH = path.resolve('docs/haberler.json');
const MAX_BACKFILL = 25;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

async function main() {
  if (!GEMINI_API_KEY) {
    console.log('[backfill-highlights] GEMINI_API_KEY tanımlı değil, çıkılıyor.');
    return;
  }
  const raw = await readFile(FEED_PATH, 'utf8');
  const data = JSON.parse(raw);
  const articles = data.articles ?? [];

  const missing = articles
    .filter((a) => !Array.isArray(a.highlights) || a.highlights.length === 0)
    .sort((a, b) => new Date(b.publishedAt ?? 0) - new Date(a.publishedAt ?? 0))
    .slice(0, MAX_BACKFILL);

  console.log(`[backfill-highlights] ${missing.length} makale işlenecek (üst sınır ${MAX_BACKFILL}).`);

  let updated = 0;
  for (const article of missing) {
    if (!article.body) continue;
    try {
      const highlights = await generateHighlights(article.body, GEMINI_API_KEY);
      if (highlights.length > 0) {
        article.highlights = highlights;
        updated++;
      }
    } catch (err) {
      console.warn(`[backfill-highlights] "${article.headline}" başarısız: ${err.message}`);
    }
  }

  await writeFile(FEED_PATH, JSON.stringify(data, null, 2), 'utf8');
  console.log(`[backfill-highlights] tamam — ${updated} makale güncellendi.`);
}

main().catch((err) => {
  console.error('[backfill-highlights] beklenmeyen hata:', err);
  process.exitCode = 1;
});
