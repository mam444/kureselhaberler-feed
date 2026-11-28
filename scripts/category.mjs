const CATEGORY_ALIASES = new Map([
  ['gundem', 'Gündem'], ['news', 'Gündem'], ['general', 'Gündem'],
  ['turkiye', 'Türkiye'], ['turkey', 'Türkiye'],
  ['dunya', 'Dünya'], ['world', 'Dünya'], ['international', 'Dünya'], ['world news', 'Dünya'],
  ['ekonomi', 'Ekonomi'], ['economy', 'Ekonomi'], ['business', 'Ekonomi'], ['finance', 'Ekonomi'],
  ['spor', 'Spor'], ['sports', 'Spor'],
  ['teknoloji', 'Teknoloji'], ['technology', 'Teknoloji'], ['tech', 'Teknoloji'],
  ['bilim ve teknoloji', 'Teknoloji'], ['science and technology', 'Teknoloji'],
  ['bilim', 'Bilim'], ['science', 'Bilim'],
  ['saglik', 'Sağlık'], ['health', 'Sağlık'],
  ['kultur sanat', 'Kültür & Sanat'], ['kultur ve sanat', 'Kültür & Sanat'], ['culture', 'Kültür & Sanat'], ['arts', 'Kültür & Sanat'],
  ['yasam', 'Yaşam'], ['lifestyle', 'Yaşam'], ['travel', 'Yaşam'], ['tourism', 'Yaşam'],
  ['egitim', 'Eğitim'], ['education', 'Eğitim'],
  ['son dakika', 'Son Dakika'], ['breaking news', 'Son Dakika'],
]);

export function categoryKey(value) {
  return String(value ?? '').normalize('NFKD').replace(/\p{M}/gu, '')
    .toLocaleLowerCase('tr-TR').replaceAll('ı', 'i')
    .replace(/[^a-z0-9]+/g, ' ').trim();
}

export function normalizeCategory(value) {
  const key = categoryKey(value);
  return CATEGORY_ALIASES.get(key) ?? String(value ?? '').trim();
}

const TOPIC_TERMS = {
  'Spor': ['spor', 'futbol', 'basketbol', 'voleybol', 'tenis', 'euroleague', 'nba', 'uefa', 'fifa', 'süper lig', 'super lig', 'derbi', 'şampiyon', 'sampiyon', 'maçında', 'maçı', 'maçı', 'transfer', 'milli takım', 'milli takim', 'formula 1', 'f1 yarışı', 'gol attı', 'gol atti', 'fenerbahçe', 'galatasaray', 'beşiktaş', 'trabzonspor', 'başakşehir', 'adana demirspor', 'anadolu efes', 'pınar karşıyaka'],
  'Ekonomi': ['ekonomi', 'enflasyon', 'faiz', 'borsa', 'döviz', 'doviz', 'dolar', 'euro kuru', 'altın fiyat', 'altin fiyat', 'yatırım', 'yatirim', 'ihracat', 'ithalat', 'bütçe', 'butce', 'asgari ücret', 'asgari ucret', 'merkez bankası', 'merkez bankasi', 'şirket', 'sirket', 'piyasa', 'vergi', 'kripto', 'bitcoin', 'finans'],
  'Teknoloji': ['teknoloji', 'yapay zeka', 'yapay zekâ', 'yazılım', 'yazilim', 'akıllı telefon', 'akilli telefon', 'siber saldırı', 'siber saldiri', 'siber güvenlik', 'siber guvenlik', 'uygulama güncelle', 'uygulama guncelle', 'işlemci', 'islemci', 'çip', 'cip', 'robot', 'android', 'iphone', 'google', 'openai', 'yeni model'],
  'Bilim': ['bilim', 'bilim insan', 'araştırma', 'arastirma', 'keşif', 'kesif', 'nasa', 'uzay teleskop', 'astronomi', 'arkeolog', 'fosil', 'deney', 'iklim araştır', 'botanik', 'bitki', 'bitki türü', 'endemik', 'herbaryum'],
  'Sağlık': ['sağlık', 'saglik', 'hastalık', 'hastalik', 'kanser', 'tedavi', 'ilaç', 'ilac', 'doktor', 'hasta', 'salgın', 'salgin', 'ameliyat', 'aşı', 'asi', 'tıp ', 'tıp dünyası', 'tıp dunyasi'],
  'Kültür & Sanat': ['kültür', 'kultur', 'sanat', 'sergi', 'konser', 'festival', 'tiyatro', 'sinema', 'film', 'dizi', 'albüm', 'album', 'müzik', 'muzik', 'oyuncu', 'yazar', 'kitap', 'bienal'],
  'Eğitim': ['eğitim', 'egitim', 'üniversite', 'universite', 'öğrenci', 'ogrenci', 'öğretmen', 'ogretmen', 'okul', 'sınav', 'sinav', 'müfredat', 'mufredat', 'yks', 'tyt', 'lgs', 'yök', 'yok'],
  'Yaşam': ['yaşam', 'yasam', 'turizm', 'turist', 'tatil', 'otel', 'seyahat', 'gastronomi', 'tarif', 'moda', 'evcil hayvan', 'hava durumu', 'meteoroloji'],
};

const GENERIC_CATEGORIES = new Set(['Gündem', 'Son Dakika', 'Dünya']);
const TURKEY_PLACE_NAMES = [
  'Türkiye', 'Turkey', 'Adana', 'Adıyaman', 'Afyon', 'Ağrı', 'Amasya', 'Ankara', 'Antalya',
  'Artvin', 'Aydın', 'Balıkesir', 'Bilecik', 'Bingöl', 'Bitlis', 'Bolu', 'Burdur', 'Bursa',
  'Çanakkale', 'Çankırı', 'Çorum', 'Denizli', 'Diyarbakır', 'Edirne', 'Elazığ', 'Erzincan',
  'Erzurum', 'Eskişehir', 'Gaziantep', 'Giresun', 'Gümüşhane', 'Hakkari', 'Hatay', 'Isparta',
  'Mersin', 'İstanbul', 'İzmir', 'Kars', 'Kastamonu', 'Kayseri', 'Kırklareli', 'Kırşehir',
  'Kocaeli', 'Konya', 'Kütahya', 'Malatya', 'Manisa', 'Kahramanmaraş', 'Mardin', 'Muğla',
  'Muş', 'Nevşehir', 'Niğde', 'Rize', 'Sakarya', 'Samsun', 'Siirt', 'Sinop', 'Sivas',
  'Tekirdağ', 'Tokat', 'Trabzon', 'Tunceli', 'Şanlıurfa', 'Uşak', 'Van', 'Yozgat', 'Zonguldak',
  'Aksaray', 'Bayburt', 'Karaman', 'Kırıkkale', 'Batman', 'Şırnak', 'Bartın', 'Ardahan',
  'Iğdır', 'Yalova', 'Karabük', 'Kilis', 'Osmaniye', 'Düzce',
];
const TURKEY_PLACE_KEYS = new Set(TURKEY_PLACE_NAMES.map(categoryKey));

function headlineMentionsTurkey(headlineText) {
  return headlineText.split(' ').some((word) => TURKEY_PLACE_KEYS.has(word));
}

function categoryFromUrl(url) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const parts = `${parsed.pathname} ${parsed.searchParams.get('cat') ?? ''}`;
    const key = categoryKey(parts);
    const paths = [
      [/\bgundem\b|\bgeneral\b/, 'Gündem'],
      [/\bspor\b|sports/, 'Spor'], [/\bekonomi\b|business|finance/, 'Ekonomi'],
      [/\bteknoloji\b|technology|\btech\b/, 'Teknoloji'], [/\bbilim\b|science/, 'Bilim'],
      [/\bsaglik\b|health/, 'Sağlık'], [/\begitim\b|education/, 'Eğitim'],
      [/\bturkiye\b|\bturkey\b/, 'Türkiye'], [/\bdunya\b|\bworld\b/, 'Dünya'],
      [/\bkultur\b|\bculture\b|arts/, 'Kültür & Sanat'], [/\byasam\b|lifestyle|travel|tourism/, 'Yaşam'],
    ];
    return paths.find(([pattern]) => pattern.test(key))?.[1] ?? null;
  } catch {
    return null;
  }
}

/** Use publisher taxonomy and strong topic evidence, then fall back to the
 * curated feed section. Breaking is a separate flag; it does not erase topic. */
export function classifyArticleCategory({
  headline = '', body = '', sourceCategory = '', feedCategories = [], url = '', lang = 'tr',
} = {}) {
  const feedLabels = (Array.isArray(feedCategories) ? feedCategories : [feedCategories])
    .map(normalizeCategory).filter(Boolean);
  const explicitFeedCategory = feedLabels.find((label) => CATEGORY_ALIASES.has(categoryKey(label))
    && !GENERIC_CATEGORIES.has(label));
  if (explicitFeedCategory) return explicitFeedCategory;

  const headlineText = categoryKey(headline);
  const scores = Object.entries(TOPIC_TERMS).map(([category, terms]) => {
    let score = 0;
    for (const term of terms) {
      const key = categoryKey(term);
      if (key.length < 4) continue;
      // Match complete normalized words/phrases. Substring matching made
      // unrelated Turkish words such as "toplantısı" look like "tıp".
      const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (new RegExp(`(?:^| )${escaped}[a-z]*(?: |$)`).test(headlineText)) score += key.includes(' ') ? 4 : 3;
    }
    return { category, score };
  }).sort((a, b) => b.score - a.score);
  if (scores[0]?.score >= 3 && scores[0].score > (scores[1]?.score ?? 0)) {
    return scores[0].category;
  }

  const pathCategory = categoryFromUrl(url);
  const sourceLabel = normalizeCategory(sourceCategory);
  if (sourceLabel && !GENERIC_CATEGORIES.has(sourceLabel)) return sourceLabel;

  // International publishers label their entire Turkish-language section as
  // World. A concrete Turkish city or country name is stronger evidence for
  // the reader-facing section than that broad publisher default.
  if (headlineMentionsTurkey(headlineText)) return 'Türkiye';

  if (pathCategory && pathCategory !== 'Gündem') return pathCategory;
  if (pathCategory) return pathCategory;
  if (sourceLabel === 'Dünya' || String(sourceCategory).toLowerCase() === 'world' || lang === 'en') {
    return 'Dünya';
  }
  return 'Gündem';
}

export function isBreakingArticle({ headline = '', sourceCategory = '', isBreaking = false } = {}) {
  return isBreaking || normalizeCategory(sourceCategory) === 'Son Dakika'
    || /\bson\s+dakika\b/i.test(String(headline));
}
