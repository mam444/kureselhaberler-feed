// KureselHaberler Flutter uygulamasındaki lib/services/news_service.dart ile
// aynı kaynak listesi — kaynak paritesini korumak için burada tekrar tanımlanır.

export const TURKISH_SOURCES = [
  { url: 'https://www.aa.com.tr/tr/rss/default?cat=guncel', name: 'Anadolu Ajansı', domain: 'aa.com.tr', defaultCategory: 'Gündem' },
  { url: 'https://www.aa.com.tr/tr/rss/default?cat=dunya', name: 'Anadolu Ajansı', domain: 'aa.com.tr', defaultCategory: 'Dünya' },
  { url: 'https://www.aa.com.tr/tr/rss/default?cat=spor', name: 'Anadolu Ajansı', domain: 'aa.com.tr', defaultCategory: 'Spor' },
  { url: 'https://www.aa.com.tr/tr/rss/default?cat=ekonomi', name: 'Anadolu Ajansı', domain: 'aa.com.tr', defaultCategory: 'Ekonomi' },
  { url: 'https://www.aa.com.tr/tr/rss/default?cat=bilim-teknoloji', name: 'Anadolu Ajansı', domain: 'aa.com.tr', defaultCategory: 'Bilim ve Teknoloji' },
  { url: 'https://www.ntv.com.tr/teknoloji.rss', name: 'NTV', domain: 'ntv.com.tr', defaultCategory: 'Teknoloji' },
  { url: 'https://www.hurriyet.com.tr/rss/anasayfa', name: 'Hürriyet', domain: 'hurriyet.com.tr', defaultCategory: 'Gündem' },
  { url: 'https://www.ntv.com.tr/gundem.rss', name: 'NTV', domain: 'ntv.com.tr', defaultCategory: 'Gündem' },
  { url: 'https://www.milliyet.com.tr/rss/rssnew/sondakikarss.xml', name: 'Milliyet', domain: 'milliyet.com.tr', defaultCategory: 'Son Dakika' },
  { url: 'https://www.milliyet.com.tr/rss/rssnew/gundemrss.xml', name: 'Milliyet', domain: 'milliyet.com.tr', defaultCategory: 'Gündem' },
  { url: 'https://www.milliyet.com.tr/rss/rssnew/dunyarss.xml', name: 'Milliyet', domain: 'milliyet.com.tr', defaultCategory: 'Dünya' },
  { url: 'https://www.milliyet.com.tr/rss/rssnew/ekonomirss.xml', name: 'Milliyet', domain: 'milliyet.com.tr', defaultCategory: 'Ekonomi' },
  { url: 'https://www.milliyet.com.tr/rss/rssnew/teknolojirss.xml', name: 'Milliyet', domain: 'milliyet.com.tr', defaultCategory: 'Teknoloji' },
  { url: 'https://www.sabah.com.tr/rss/anasayfa.xml', name: 'Sabah', domain: 'sabah.com.tr', defaultCategory: 'Gündem' },
  { url: 'https://www.cnnturk.com/feed/rss/all/news', name: 'CNN Türk', domain: 'cnnturk.com', defaultCategory: 'Gündem' },
  { url: 'https://www.haberturk.com/rss', name: 'Habertürk', domain: 'haberturk.com', defaultCategory: 'Gündem' },
  // TRT's public "Sitene Ekle" page documents the *_articles.rss endpoints.
  // Keep one publisher label while combining its topical feeds; the generator
  // still selects at most one fresh story per publisher in each round.
  { url: 'https://www.trthaber.com/manset_articles.rss', name: 'TRT Haber', domain: 'trthaber.com', defaultCategory: 'Gündem' },
  { url: 'https://www.trthaber.com/sondakika_articles.rss', name: 'TRT Haber', domain: 'trthaber.com', defaultCategory: 'Son Dakika' },
  { url: 'https://www.trthaber.com/turkiye_articles.rss', name: 'TRT Haber', domain: 'trthaber.com', defaultCategory: 'Gündem' },
  { url: 'https://www.trthaber.com/dunya_articles.rss', name: 'TRT Haber', domain: 'trthaber.com', defaultCategory: 'Dünya' },
  { url: 'https://www.trthaber.com/ekonomi_articles.rss', name: 'TRT Haber', domain: 'trthaber.com', defaultCategory: 'Ekonomi' },
  { url: 'https://www.trthaber.com/spor_articles.rss', name: 'TRT Haber', domain: 'trthaber.com', defaultCategory: 'Spor' },
  { url: 'https://www.trthaber.com/saglik_articles.rss', name: 'TRT Haber', domain: 'trthaber.com', defaultCategory: 'Sağlık' },
  { url: 'https://www.trthaber.com/bilim_teknoloji_articles.rss', name: 'TRT Haber', domain: 'trthaber.com', defaultCategory: 'Bilim ve Teknoloji' },
  { url: 'https://www.yenisafak.com/rss?xml=gundem', name: 'Yeni Şafak', domain: 'yenisafak.com', defaultCategory: 'Gündem' },
  { url: 'https://feeds.bbci.co.uk/turkce/rss.xml', name: 'BBC Türkçe', domain: 'bbc.com', defaultCategory: 'Dünya' },
  { url: 'https://rss.dw.com/xml/rss-tur-all', name: 'DW Türkçe', domain: 'dw.com', defaultCategory: 'Dünya' },
  { url: 'https://tr.euronews.com/rss', name: 'Euronews', domain: 'euronews.com', defaultCategory: 'Dünya' },
].map((s) => ({ ...s, lang: 'tr' }));

export const INTERNATIONAL_SOURCES = [
  // NASA material is generally public information in a factual editorial
  // context; item-level third-party notices still take precedence. Keep the
  // NASA source credit visible and never imply NASA endorsement.
  { url: 'https://www.nasa.gov/feed/', name: 'NASA', domain: 'nasa.gov', defaultCategory: 'Bilim ve Teknoloji', allowArticlePageRead: true, attributionNote: 'NASA kaynaklarından yararlanılarak hazırlanmıştır; NASA ile resmî bağlantı veya onay anlamına gelmez.' },
  // EU-owned editorial content is generally CC BY 4.0 unless the item says
  // otherwise. Adaptations must credit the source and state that they changed.
  { url: 'https://ec.europa.eu/commission/presscorner/api/rss?language=en', name: 'European Commission', domain: 'europa.eu', defaultCategory: 'World', allowArticlePageRead: true, attributionNote: 'Özet, European Commission içeriğinden uyarlanmıştır (CC BY 4.0). Kaynak bağlantısı haberde yer alır.' },
  { url: 'https://ec.europa.eu/eurostat/en/search?_estatsearchportlet_WAR_estatsearchportlet_collection=CAT_PREREL&_estatsearchportlet_WAR_estatsearchportlet_theme=PER_ECOFIN&p_p_id=estatsearchportlet_WAR_estatsearchportlet&p_p_lifecycle=2&p_p_mode=view&p_p_resource_id=atom&p_p_state=maximized', name: 'Eurostat', domain: 'europa.eu', defaultCategory: 'Ekonomi', allowArticlePageRead: true, attributionNote: 'Özet, Eurostat içeriğinden uyarlanmıştır (CC BY 4.0). Kaynak bağlantısı haberde yer alır.' },
  { url: 'https://ec.europa.eu/eurostat/en/search?_estatsearchportlet_WAR_estatsearchportlet_collection=CAT_PREREL&_estatsearchportlet_WAR_estatsearchportlet_theme=PER_POPSOC&p_p_id=estatsearchportlet_WAR_estatsearchportlet&p_p_lifecycle=2&p_p_mode=view&p_p_resource_id=atom&p_p_state=maximized', name: 'Eurostat', domain: 'europa.eu', defaultCategory: 'Dünya', allowArticlePageRead: true, attributionNote: 'Özet, Eurostat içeriğinden uyarlanmıştır (CC BY 4.0). Kaynak bağlantısı haberde yer alır.' },
  { url: 'https://ec.europa.eu/eurostat/en/search?_estatsearchportlet_WAR_estatsearchportlet_collection=CAT_PREREL&_estatsearchportlet_WAR_estatsearchportlet_theme=PER_ENVENE&p_p_id=estatsearchportlet_WAR_estatsearchportlet&p_p_lifecycle=2&p_p_mode=view&p_p_resource_id=atom&p_p_state=maximized', name: 'Eurostat', domain: 'europa.eu', defaultCategory: 'Çevre', allowArticlePageRead: true, attributionNote: 'Özet, Eurostat içeriğinden uyarlanmıştır (CC BY 4.0). Kaynak bağlantısı haberde yer alır.' },
  { url: 'https://ec.europa.eu/eurostat/en/search?_estatsearchportlet_WAR_estatsearchportlet_collection=CAT_PREREL&_estatsearchportlet_WAR_estatsearchportlet_theme=PER_RESDEV&p_p_id=estatsearchportlet_WAR_estatsearchportlet&p_p_lifecycle=2&p_p_mode=view&p_p_resource_id=atom&p_p_state=maximized', name: 'Eurostat', domain: 'europa.eu', defaultCategory: 'Bilim ve Teknoloji', allowArticlePageRead: true, attributionNote: 'Özet, Eurostat içeriğinden uyarlanmıştır (CC BY 4.0). Kaynak bağlantısı haberde yer alır.' },
  { url: 'https://www.eea.europa.eu/en/newsroom/newsletter/eea-press-releases-rss-feed/rss.xml', name: 'European Environment Agency', domain: 'eea.europa.eu', defaultCategory: 'Çevre', allowArticlePageRead: true, attributionNote: 'Özet, European Environment Agency (EEA) içeriğinden uyarlanmıştır (CC BY). Kaynak bağlantısı haberde yer alır; üçüncü taraf içerikler lisans dışı olabilir.' },
  { url: 'https://www.consilium.europa.eu/en/rss/pressreleases.ashx', name: 'Council of the EU', domain: 'consilium.europa.eu', defaultCategory: 'Dünya', allowArticlePageRead: true, attributionNote: 'Özet, Council of the EU içeriğinden uyarlanmıştır. Kaynak bağlantısı haberde yer alır; anlamı değiştirecek şekilde yorumlanmamalıdır.' },
  { url: 'https://feeds.abcnews.com/abcnews/internationalheadlines', name: 'ABC News', domain: 'abcnews.go.com', defaultCategory: 'World' },
  // VOA publishes these regional RSS feeds directly from its official feed page.
  { url: 'https://www.voanews.com/api/z-botl-vomx-tpertmq', name: 'VOA Africa', domain: 'voanews.com', defaultCategory: 'World' },
  { url: 'https://www.voanews.com/api/zjbovl-vomx-tpebvmr', name: 'VOA Europe', domain: 'voanews.com', defaultCategory: 'World' },
  { url: 'https://www.voanews.com/api/zoripl-vomx-tpeptmm', name: 'VOA Americas', domain: 'voanews.com', defaultCategory: 'World' },
  { url: 'http://feeds.bbci.co.uk/news/world/rss.xml', name: 'BBC News', domain: 'bbc.com', defaultCategory: 'World' },
  { url: 'https://www.aljazeera.com/xml/rss/all.xml', name: 'Al Jazeera', domain: 'aljazeera.com', defaultCategory: 'World' },
  { url: 'https://www.theguardian.com/world/rss', name: 'The Guardian', domain: 'theguardian.com', defaultCategory: 'World' },
  { url: 'http://rss.cnn.com/rss/edition_world.rss', name: 'CNN International', domain: 'cnn.com', defaultCategory: 'World' },
  { url: 'https://feeds.skynews.com/feeds/rss/world.xml', name: 'Sky News', domain: 'skynews.com', defaultCategory: 'World' },
  { url: 'https://www.france24.com/en/rss', name: 'France 24', domain: 'france24.com', defaultCategory: 'World' },
  { url: 'https://feeds.npr.org/1004/rss.xml', name: 'NPR', domain: 'npr.org', defaultCategory: 'World' },
  { url: 'https://rss.dw.com/xml/rss-en-world', name: 'DW English', domain: 'dw.com', defaultCategory: 'World' },
  { url: 'https://www.rfi.fr/en/rss', name: 'RFI English', domain: 'rfi.fr', defaultCategory: 'World' },
].map((s) => ({ ...s, lang: 'en' }));

// Publishers below explicitly restrict RSS/metadata reuse to non-commercial
// use or require a business licence. This ad-supported service excludes them
// until written commercial syndication permission is obtained. CNN Türk is a
// separate source/domain and is not the CNN International feed listed here.
export const LICENSE_REQUIRED_PUBLISHERS = [
  'BBC Türkçe',
  'BBC News',
  'The Guardian',
  'CNN International',
  'Euronews',
];

const licenseRequired = new Set(LICENSE_REQUIRED_PUBLISHERS);
export const ALL_SOURCES = [...TURKISH_SOURCES, ...INTERNATIONAL_SOURCES]
  .filter((source) => !licenseRequired.has(source.name));

export function iconUrlFor(domain) {
  return `https://www.google.com/s2/favicons?sz=64&domain=${domain}`;
}
