# kureselhaberler-feed

KureselHaberler mobil uygulaması için, RSS haberlerini **Gemini** ile özgün cümlelerle yeniden yazıp
**Unsplash**'tan gerçek bir kapak fotoğrafı ekleyen ve sonucu `docs/haberler.json` olarak
**GitHub Pages** üzerinden yayınlayan otomasyon hattı. `GitHub Actions` bu betiği her 10 dakikada
bir çalıştırır.

## Nasıl çalışır

1. `.github/workflows/generate-feed.yml` her 10 dakikada bir (ve manuel olarak da) tetiklenir.
2. `scripts/generate-feed.mjs`:
   - `scripts/sources.mjs`'teki RSS kaynaklarını çeker,
   - önceki `docs/haberler.json`'da olmayan en fazla 2 yeni haberi, RSS açıklamasını en fazla 1.600 karakter kullanarak Gemini ile yeniden yazar,
   - Gemini günlük kotası dolduğunda kaynağın doğrulanmış başlığı ve en fazla 420 karakterlik RSS özetini yayınlar; haber akışı tamamen durmaz,
   - Gemini ile hazırlanan her haber için Unsplash'tan konuya uygun bir fotoğraf bulur; RSS yedeğinde yayıncı görselini yeniden dağıtmaz,
   - sonucu eskisiyle birleştirip `docs/haberler.json`'a yazar (en fazla 600 haber tutulur),
   - gerçekten yeni haber varsa Android'e FCM üzerinden, web/iOS'a OneSignal üzerinden push gönderir.
3. Değişiklik varsa Action, `docs/haberler.json`'u commit'leyip push eder.
4. GitHub Pages (`Settings → Pages → Deploy from branch → main /docs`), bu dosyayı şu adreste
   yayınlar: `https://<kullanıcı-adı>.github.io/kureselhaberler-feed/haberler.json`

## Kurulum

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
