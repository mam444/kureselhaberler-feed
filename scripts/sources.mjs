// KureselHaberler Flutter uygulamasındaki lib/services/news_service.dart ile
// aynı kaynak listesi — kaynak paritesini korumak için burada tekrar tanımlanır.

export const TURKISH_SOURCES = [
  { url: 'https://www.aa.com.tr/tr/rss/default?cat=guncel', name: 'Anadolu Ajansı', domain: 'aa.com.tr', defaultCategory: 'Gündem' },
  { url: 'https://www.aa.com.tr/tr/rss/default?cat=dunya', name: 'Anadolu Ajansı', domain: 'aa.com.tr', defaultCategory: 'Dünya' },
  { url: 'https://www.aa.com.tr/tr/rss/default?cat=spor', name: 'Anadolu Ajansı', domain: 'aa.com.tr', defaultCategory: 'Spor' },
  { url: 'https://www.hurriyet.com.tr/rss/anasayfa', name: 'Hürriyet', domain: 'hurriyet.com.tr', defaultCategory: 'Gündem' },
  { url: 'https://www.ntv.com.tr/gundem.rss', name: 'NTV', domain: 'ntv.com.tr', defaultCategory: 'Gündem' },
  { url: 'https://www.milliyet.com.tr/rss/rssnew/gundemrss.xml', name: 'Milliyet', domain: 'milliyet.com.tr', defaultCategory: 'Son Dakika' },
  { url: 'https://www.sabah.com.tr/rss/anasayfa.xml', name: 'Sabah', domain: 'sabah.com.tr', defaultCategory: 'Gündem' },
  { url: 'https://www.cnnturk.com/feed/rss/all/news', name: 'CNN Türk', domain: 'cnnturk.com', defaultCategory: 'Gündem' },
  { url: 'https://www.haberturk.com/rss', name: 'Habertürk', domain: 'haberturk.com', defaultCategory: 'Gündem' },
  { url: 'https://www.trthaber.com/manset.rss', name: 'TRT Haber', domain: 'trthaber.com', defaultCategory: 'Gündem' },
  { url: 'https://www.yenisafak.com/rss?xml=gundem', name: 'Yeni Şafak', domain: 'yenisafak.com', defaultCategory: 'Gündem' },
  { url: 'https://feeds.bbci.co.uk/turkce/rss.xml', name: 'BBC Türkçe', domain: 'bbc.com', defaultCategory: 'Dünya' },
  { url: 'https://rss.dw.com/xml/rss-tur-all', name: 'DW Türkçe', domain: 'dw.com', defaultCategory: 'Dünya' },
  { url: 'https://tr.euronews.com/rss', name: 'Euronews', domain: 'euronews.com', defaultCategory: 'Dünya' },
].map((s) => ({ ...s, lang: 'tr' }));

export const INTERNATIONAL_SOURCES = [
  { url: 'http://feeds.bbci.co.uk/news/world/rss.xml', name: 'BBC News', domain: 'bbc.com', defaultCategory: 'World' },
  { url: 'https://www.aljazeera.com/xml/rss/all.xml', name: 'Al Jazeera', domain: 'aljazeera.com', defaultCategory: 'World' },
  { url: 'https://www.theguardian.com/world/rss', name: 'The Guardian', domain: 'theguardian.com', defaultCategory: 'World' },
  { url: 'http://rss.cnn.com/rss/edition_world.rss', name: 'CNN International', domain: 'cnn.com', defaultCategory: 'World' },
  { url: 'https://feeds.skynews.com/feeds/rss/world.xml', name: 'Sky News', domain: 'skynews.com', defaultCategory: 'World' },
].map((s) => ({ ...s, lang: 'en' }));

export const ALL_SOURCES = [...TURKISH_SOURCES, ...INTERNATIONAL_SOURCES];

export function iconUrlFor(domain) {
  return `https://www.google.com/s2/favicons?sz=64&domain=${domain}`;
}
