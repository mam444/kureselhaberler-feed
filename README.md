# kureselhaberler-feed

KureselHaberler mobil uygulaması için, RSS haberlerini **Groq** ile özgün cümlelerle yeniden yazıp
**Unsplash**'tan gerçek bir kapak fotoğrafı ekleyen ve sonucu `docs/haberler.json` olarak
**GitHub Pages** üzerinden yayınlayan otomasyon hattı. `GitHub Actions` bu betiği her 10 dakikada
bir çalıştırır.

## Nasıl çalışır

1. `.github/workflows/generate-feed.yml` her 10 dakikada bir (ve manuel olarak da) tetiklenir.
2. `scripts/generate-feed.mjs`:
   - `scripts/sources.mjs`'teki RSS kaynaklarını çeker,
   - önceki `docs/haberler.json`'da olmayan (en fazla 8) yeni haberi Groq ile yeniden yazar,
   - her biri için Unsplash'tan konuya uygun bir fotoğraf bulur,
   - sonucu eskisiyle birleştirip `docs/haberler.json`'a yazar (en fazla 300 haber tutulur),
   - gerçekten yeni haber varsa OneSignal ile bir push bildirimi gönderir.
3. Değişiklik varsa Action, `docs/haberler.json`'u commit'leyip push eder.
4. GitHub Pages (`Settings → Pages → Deploy from branch → main /docs`), bu dosyayı şu adreste
   yayınlar: `https://<kullanıcı-adı>.github.io/kureselhaberler-feed/haberler.json`

## Kurulum

1. Bu repoyu GitHub'da oluşturup push edin.
2. `Settings → Pages` içinde kaynak olarak `main` dalı / `/docs` klasörünü seçin.
3. `Settings → Secrets and variables → Actions` içine şu secret'ları ekleyin:
   - `GROQ_API_KEY` — https://console.groq.com/keys
   - `UNSPLASH_ACCESS_KEY` — https://unsplash.com/oauth/applications ("New Application" → Access Key)
   - `ONESIGNAL_APP_ID`, `ONESIGNAL_REST_API_KEY` — https://onesignal.com (yeni app → Settings → Keys & IDs)
4. `Actions` sekmesinden `Generate feed` workflow'unu `Run workflow` ile bir kez elle tetikleyip
   loglardan ve oluşan `docs/haberler.json`'dan kontrol edin.

## Yerel test

```bash
npm install
node --env-file=.env scripts/generate-feed.mjs
```

`.env.example` dosyasını `.env` olarak kopyalayıp key'lerinizi doldurun. Key'ler boşsa betik
RSS'i çeker ama hiçbir haberi yeniden yazmaz (Groq olmadan içerik yayınlanmaz — telif riskini
azaltan asıl adım budur).
