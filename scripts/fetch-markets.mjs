import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const MARKETS_PATH = path.resolve('docs/markets.json');

// Yahoo Finance'in kendi chart widget'ının kullandığı genel uç nokta —
// anahtar gerektirmiyor, ama tarayıcıdan çağrılırsa CORS engelliyor; bu
// yüzden burada (GitHub Actions/Node tarafında, CORS'un uygulanmadığı bir
// ortamda) çekilip statik markets.json'a yazılıyor, site ise o statik
// dosyayı kendi origin'inden okuyor.
const YAHOO_CHART = 'https://query1.finance.yahoo.com/v8/finance/chart/';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Safari/537.36';
const GRAMS_PER_TROY_OUNCE = 31.1034768;

async function fetchQuote(symbol) {
  const res = await fetch(`${YAHOO_CHART}${encodeURIComponent(symbol)}`, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const meta = data?.chart?.result?.[0]?.meta;
  if (!meta || typeof meta.regularMarketPrice !== 'number') throw new Error('fiyat alanı yok');
  const price = meta.regularMarketPrice;
  const prevClose = meta.previousClose ?? meta.chartPreviousClose ?? price;
  const changePct = prevClose ? ((price - prevClose) / prevClose) * 100 : 0;
  return { price, changePct };
}

async function loadPrevious() {
  try {
    const raw = await readFile(MARKETS_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// Bir sembol çekilemezse (geçici Yahoo hatası vb.) tüm widget'ı boşaltmak
// yerine bir önceki başarılı değeri korur — haber feed'indeki "önceki
// haberleri koru" mantığıyla aynı dayanıklılık prensibi.
async function safeFetch(symbol, previousEntry) {
  try {
    return { ...(await fetchQuote(symbol)), stale: false };
  } catch (err) {
    console.warn(`[markets] ${symbol} çekilemedi: ${err.message}`);
    return previousEntry ? { ...previousEntry, stale: true } : null;
  }
}

async function main() {
  const previous = await loadPrevious();

  const [usdTry, eurTry, gold, bist100] = await Promise.all([
    safeFetch('USDTRY=X', previous?.usdTry),
    safeFetch('EURTRY=X', previous?.eurTry),
    safeFetch('GC=F', previous?.gold),
    safeFetch('XU100.IS', previous?.bist100),
  ]);

  // Ons altın (USD) -> gram altın (TRY): önce dolar bazlı gram, sonra
  // güncel USDTRY kuruyla çeviriliyor. usdTry gelmezse (çok nadir), altın
  // bloğunu da bir önceki dosyadaki hazır TRY değeriyle bırakıyoruz.
  let goldGramTry = previous?.goldGramTry ?? null;
  if (gold && usdTry) {
    goldGramTry = { price: (gold.price / GRAMS_PER_TROY_OUNCE) * usdTry.price, changePct: gold.changePct, stale: gold.stale || usdTry.stale };
  }

  const result = {
    updatedAt: new Date().toISOString(),
    usdTry,
    eurTry,
    goldGramTry,
    bist100,
  };

  await mkdir(path.dirname(MARKETS_PATH), { recursive: true });
  await writeFile(MARKETS_PATH, JSON.stringify(result, null, 2), 'utf8');
  console.log('[markets] docs/markets.json yazıldı.', result);
}

main().catch((err) => {
  console.error('[markets] beklenmeyen hata:', err);
  process.exitCode = 1;
});
