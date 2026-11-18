# kureselhaberler-feed

KureselHaberler mobil uygulaması için, RSS haberlerini **Gemini** ile özgün cümlelerle yeniden yazıp
**Unsplash**'tan gerçek bir kapak fotoğrafı ekleyen ve sonucu `docs/haberler.json` olarak
**GitHub Pages** üzerinden yayınlayan otomasyon hattı. `GitHub Actions` bu betiği her 10 dakikada
bir çalıştırır.

## Nasıl çalışır

1. `.github/workflows/generate-feed.yml` her 10 dakikada bir (ve manuel olarak da) tetiklenir. Mobil uygulama açıkken akışı 5 dakikada bir koşullu istekle kontrol eder; veri değişmediyse tam JSON'u yeniden indirmez.
2. `scripts/generate-feed.mjs`:
   - `scripts/sources.mjs`'teki RSS kaynaklarını çeker,
   - önceki `docs/haberler.json`'da olmayan en fazla 2 yeni haberi, RSS veya hem yayıncının açık yeniden kullanım koşulları hem tarama kuralları izin verdiğinde sayfa metnini kullanarak Gemini ile yeniden yazar; zengin kaynak uygunsa 180–280 kelimelik çok paragraflı özet hedefler,
   - saatte en fazla 12 yeni haber yayınlar; Gemini günlük kotası dolduğunda kaynağın doğrulanmış başlığı ve en fazla 420 karakterlik RSS özetini yayınlar; haber akışı tamamen durmaz,
   - Gemini ile hazırlanan her haber için Unsplash'tan konuya uygun bir fotoğraf bulur; RSS yedeğinde yayıncı görselini yeniden dağıtmaz,
   - sonucu eskisiyle birleştirip `docs/haberler.json`'a yazar (en fazla 600 haber tutulur),
   - gerçekten yeni haber varsa Android'e FCM üzerinden, web/iOS'a OneSignal üzerinden push gönderir.
3. Değişiklik varsa Action, `docs/haberler.json`'u commit'leyip push eder.
4. GitHub Pages (`Settings → Pages → Deploy from branch → main /docs`), bu dosyayı şu adreste
   yayınlar: `https://<kullanıcı-adı>.github.io/kureselhaberler-feed/haberler.json`

## Kurulum

## Kaynak ve yeniden kullanım koşulları

- Kamuya açık RSS uç noktası tek başına ticari yeniden kullanım izni sayılmaz. Yeni bir kaynağı eklemeden önce yayıncının lisans/iş koşulları incelenmelidir.
- Lisansı açık kaynaklar: NASA'nın olguya dayalı kamu bilgileri (üçüncü taraf istisnaları ve NASA onayı izlenimi yasağıyla); Avrupa Komisyonu ve Eurostat'ın aksi belirtilmeyen AB mülkiyetindeki içerikleri (CC BY 4.0); EEA'nın EEA'ya ait ve aksi belirtilmeyen içerikleri (CC BY); Council of the EU içeriği (kaynak belirtme, değişikliği açıklama ve anlamı bozmama şartıyla).
- Kaynak atfı, orijinal haber bağlantısı ve varsa uyarlama notu `docs/index.html` ile Flutter haber detayında gösterilir. Kaynak görselleri yeniden dağıtılmaz; kapak için Unsplash kullanılır.
- Ticari RSS kullanımı için lisans istediğini veya yalnızca ticari olmayan kullanıma izin verdiğini açıkça belirten BBC, The Guardian, CNN International ve Euronews akışları, yazılı ticari izin alınana kadar `ALL_SOURCES` listesinin dışında tutulur. `CNN Türk` ayrı bir yayıncı akışıdır.
- Bir kaynağın lisans şartı veya haber öğesindeki hak bildirimi değişirse, o öğe kaynak bazında tekrar kontrol edilmelidir. Otomasyon üçüncü taraf istisnalarını kendiliğinden tespit edemez.
- Bu liste yalnızca burada adı geçen yeni kaynakların koşullarını belgelemektedir; mevcut Türkçe ve uluslararası yayıncı akışlarının ticari yeniden kullanım şartları ayrıca kaynak bazında doğrulanmalıdır.

1. Bu repoyu GitHub'da oluşturup push edin.
2. `Settings → Pages` içinde kaynak olarak `main` dalı / `/docs` klasörünü seçin.
3. `Settings → Secrets and variables → Actions` içine şu secret'ları ekleyin:
   - `GEMINI_API_KEY` — https://aistudio.google.com/apikey
   - `UNSPLASH_ACCESS_KEY` — https://unsplash.com/oauth/applications ("New Application" → Access Key)
   - `ONESIGNAL_APP_ID`, `ONESIGNAL_REST_API_KEY` — https://onesignal.com (web/iOS push için; Settings → Keys & IDs)
4. Android push için kalıcı Firebase hizmet hesabı JSON anahtarı kullanmayın. Workflow, Google Cloud Workload Identity Federation ile kısa ömürlü erişim belirteci alır ve yalnızca `firebase.messaging` kapsamını ister. Google Cloud tarafındaki OIDC sağlayıcısı ve `kuresel-feed-fcm-sender@kuresel-haberler.iam.gserviceaccount.com` hizmet hesabı yetkisi önceden ayarlanmış olmalıdır; GitHub workflow'u `mam444/kureselhaberler-feed` deposunun `main` dalında çalışır.
5. `Actions` sekmesinden `Generate feed` workflow'unu `Run workflow` ile elle tetikleyebilir, loglardan ve oluşan `docs/haberler.json` / `docs/markets.json` dosyalarından sonucu kontrol edebilirsiniz. Bu işlem gerçek feed'i ve abone kullanıcılara push bildirimini günceller.

## Yerel geliştirme

```bash
npm install
node --env-file=.env scripts/generate-feed.mjs
```

`.env.example` dosyasını `.env` olarak kopyalayıp API anahtarlarını doldurun. Key'ler boşsa veya
Gemini günlük kotası doluysa yeni haberler yalnızca kısa RSS özeti ve asıl yayıncı bağlantısıyla
gösterilir; içerik uydurulmaz. Yerel `generate` çalıştırması Google Cloud OIDC workflow'unun yerine
geçmez; gerçek yeni makaleler işlendiğinde yapılandırılmış bildirim sağlayıcılarına push gönderebilir.
Üretim hesabı kimlik bilgileriyle yerelde çalıştırmayın. GitHub'daki `Run workflow` da canlı feed'i
ve abonelere bildirimleri günceller; yalnızca gerçek güncelleme yapmak istediğinizde kullanın.
