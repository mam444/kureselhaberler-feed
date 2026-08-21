// One-off local backfill: fills `category: null` on articles already
// published before sources.mjs's defaultCategory fix (2026-08-21) landed.
// Uses each article's stored `source` name to infer the same category its
// RSS source would now default to — no Groq/Unsplash calls, just metadata.
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const FEED_PATH = path.resolve('docs/haberler.json');

const SOURCE_CATEGORY = {
  'Anadolu Ajansı': 'Gündem',
  'Hürriyet': 'Gündem',
  'NTV': 'Gündem',
  'Milliyet': 'Son Dakika',
  'Sabah': 'Gündem',
  'CNN Türk': 'Gündem',
  'Habertürk': 'Gündem',
  'TRT Haber': 'Gündem',
  'Yeni Şafak': 'Gündem',
  'BBC Türkçe': 'Dünya',
  'DW Türkçe': 'Dünya',
  'Euronews': 'Dünya',
  'BBC News': 'World',
  'Al Jazeera': 'World',
  'The Guardian': 'World',
  'CNN International': 'World',
  'Sky News': 'World',
};

const data = JSON.parse(await readFile(FEED_PATH, 'utf8'));
let changed = 0;
for (const a of data.articles) {
  if (!a.category && SOURCE_CATEGORY[a.source]) {
    a.category = SOURCE_CATEGORY[a.source];
    changed++;
  }
}
await writeFile(FEED_PATH, JSON.stringify(data, null, 2), 'utf8');
console.log(`[backfill] ${changed} haberin kategorisi dolduruldu.`);
