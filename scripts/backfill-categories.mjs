import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { classifyArticleCategory, isBreakingArticle } from './category.mjs';

const FEED_PATH = path.resolve('docs/haberler.json');
const apply = process.argv.includes('--apply');
const data = JSON.parse(await readFile(FEED_PATH, 'utf8'));
const before = data.articles.map((article) => ({ ...article }));
let changed = 0;
for (const article of data.articles) {
  const category = classifyArticleCategory({
    headline: article.headline,
    body: article.body,
    sourceCategory: article.category,
    url: article.externalUrl,
    lang: article.lang,
  });
  const isBreaking = isBreakingArticle({
    headline: article.headline,
    sourceCategory: article.category,
    isBreaking: article.isBreaking,
  });
  if (article.category !== category || (isBreaking && article.isBreaking !== true)) changed += 1;
  article.category = category;
  if (isBreaking) article.isBreaking = true;
}

console.log(`[category backfill] ${data.articles.length} haber; ${changed} kategori/son dakika etiketi güncellenecek.`);
const groups = new Map();
for (const article of data.articles) {
  const group = groups.get(article.category) ?? [];
  group.push(article);
  groups.set(article.category, group);
}
for (const [category, articles] of [...groups].sort((a, b) => b[1].length - a[1].length)) {
  console.log(`  ${category}: ${articles.length}`);
  for (const article of articles.slice(0, 3)) console.log(`    • ${article.headline}`);
}
console.log(`  Son Dakika işaretli: ${data.articles.filter((article) => article.isBreaking).length}`);

if (apply) {
  await writeFile(FEED_PATH, JSON.stringify(data, null, 2), 'utf8');
  console.log('[category backfill] Değişiklikler haber kapaklarına ve kaynak alanlarına dokunmadan kaydedildi.');
} else {
  console.log('[category backfill] Önizleme tamamlandı; yazmak için --apply kullanın.');
}
