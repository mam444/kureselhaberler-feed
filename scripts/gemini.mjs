// Use Gemini's native REST endpoint. The OpenAI-compat route expects a Bearer
// key, but this key is an API key and the native GenerateContent endpoint
// authenticates it with x-goog-api-key (not Authorization: Bearer).
// "gemini-3.6-flash"in bu projedeki gerçek ücretsiz kademe kotası günde
// sadece 20 istek çıktı (Google'ın kendi 429 yanıtında doğrulandı,
// 2026-08-22) — yaygın "günde 1500" rakamı bu modele uymuyor. "-lite"
// ailesi ayrı ve çok daha geniş bir kotaya sahip (aynı hesapla canlı test
// edildi, kaliteli/uzun makale üretimi doğrulandı) — o yüzden buraya
// geçildi. Kotayla ilgili şüphe varsa https://ai.dev/rate-limit üzerinden
// (Google hesabı girişiyle) canlı kontrol edilebilir, buradan değil.
const MODEL = 'gemini-3.5-flash-lite';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

const SYSTEM_PROMPT = `Sen Küresel Haberler için kaynak metne sadık bir haber editörüsün. Sana bir haberin
başlığı ve RSS kaynağının sağladığı özet verilir. Bunlar dışında haber metnini açıp doğrulayamazsın.
Görevin yalnızca verilen bilgileri açık, doğal Türkçe ile yeniden yazmaktır.

DOĞRULUK KURALLARI (uzunluk veya üslup hedeflerinden önce gelir):
1. Kaynakta bulunmayan hiçbir olguyu ekleme: kişi/kurum/yer adı, tarih, sayı, sonuç, açıklama,
   alıntı, neden, tahmin veya arka plan bilgisi UYDURMA. Genel gazetecilik kalıplarıyla metni
   uzatma; kaynakta olmayan bir bağlamı ima etme.
2. Kişi adlarını, kurumları, yerleri, sayıları, tarihleri, belirsizlikleri ve iddiaların kime ait
   olduğunu aynen koru. İddiaları kesinleşmiş gerçek gibi sunma. Kaynakta olmayan ayrıntı yoksa
   yalnızca mevcut bilgiyi yaz; kısa bir haber özeti uzun ama dayanaksız metinden iyidir.
3. Başlıkta haberin temel iddiasını değiştirme veya büyütme. Kaynak tümü büyük harfliyse normal
   Türkçe yazımına çevir; yeni bir iddia ekleme.
4. Body'yi kaynakta bulunan ayrıntı miktarına göre yaz: tek paragrafta 1-3 kısa cümle, yaklaşık
   25-70 kelime. Yalnızca kaynağı kısalt veya çevir; yeni bağlam ve arka plan ekleme. Kaynak
   kısaysa daha kısa yaz. Uzunluk doldurmak için tekrar, tahmin veya genel dolgu cümlesi kullanma.
5. İngilizce kaynakları Türkçeye çevirirken yeni bilgi ekleme. Kaynağın dili veya anlamı belirsizse
   belirsizliği koru; boşlukları kendi varsayımınla doldurma.
6. 1-3 kelimelik, İngilizce, Unsplash'ta aramaya uygun ve haber konusuna gerçekten uyan somut bir
   imageKeyword seç. Habere uygun görsel bulunamıyorsa genel veya yanıltıcı bir sahne tarif etme;
   null döndür.
7. Kategori üretme; kategori ayrıca atanıyor.
8. highlights alanında body'de açıkça bulunan en fazla 3 kısa noktayı ver. Kaynakta üç ayrı bilgi
   yoksa daha az öğe döndür; hiçbir noktayı çıkarım yoluyla ekleme.

Yalnızca şu JSON şemasında cevap ver, başka hiçbir şey yazma:
{"headline":"...","body":"...","imageKeyword":"...","highlights":["...","..."]}`;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Gemini occasionally returns rate limits and temporary model-capacity errors.
// Retry those short-lived failures so a fresh story is not lost for a full feed cycle.
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

function retryDelayMs(response, errorText, attempt) {
  const retryAfter = response.headers.get('retry-after');
  if (retryAfter) {
    const seconds = Number(retryAfter);
    const dateDelay = Date.parse(retryAfter) - Date.now();
    const parsed = Number.isFinite(seconds) ? seconds * 1000 : dateDelay;
    if (Number.isFinite(parsed) && parsed > 0) return Math.min(parsed, 60_000);
  }

  try {
    const payload = JSON.parse(errorText);
    const retryInfo = payload?.error?.details?.find?.((detail) =>
      String(detail['@type'] ?? '').endsWith('.RetryInfo'),
    );
    const seconds = retryInfo?.retryDelay ? Number.parseFloat(retryInfo.retryDelay) : NaN;
    if (Number.isFinite(seconds) && seconds > 0) return Math.min(seconds * 1000, 60_000);
  } catch {
    // Fall back to bounded exponential backoff for plain-text API errors.
  }

  const match = /retry.{0,20}?([\d.]+)s/i.exec(errorText);
  if (match) return Math.min(Math.ceil(Number.parseFloat(match[1]) * 1000) + 300, 60_000);
  return Math.min(1500 * (2 ** attempt), 12_000) + Math.floor(Math.random() * 500);
}

async function generateContent(payload, apiKey, retries) {
  for (let attempt = 0; ; attempt += 1) {
    let response;
    try {
      response = await fetch(GEMINI_URL, {
        method: 'POST',
        headers: {
          'x-goog-api-key': apiKey.replace(/^Bearer\s+/i, ''),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(45_000),
      });
    } catch (error) {
      if (attempt >= retries) throw error;
      const waitMs = Math.min(1500 * (2 ** attempt), 12_000) + Math.floor(Math.random() * 500);
      console.warn(`[gemini] geçici bağlantı hatası; ${waitMs}ms sonra yeniden denenecek.`);
      await sleep(waitMs);
      continue;
    }

    if (response.ok) return response;
    const errorText = await response.text();
    if (!RETRYABLE_STATUS.has(response.status) || attempt >= retries) {
      throw new Error(`Gemini API ${response.status}: ${errorText}`);
    }

    const waitMs = retryDelayMs(response, errorText, attempt);
    console.warn(`[gemini] API ${response.status}; ${waitMs}ms sonra yeniden denenecek (${retries - attempt} deneme kaldı).`);
    await sleep(waitMs);
  }
}

export async function rewriteArticle({ headline, body, category }, apiKey, retries = 3) {
  const userContent = [
    `Başlık: ${headline}`,
    body ? `Özet: ${body}` : null,
    category ? `Kategori (referans amaçlı, değiştirme): ${category}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  const res = await generateContent({
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{ role: 'user', parts: [{ text: userContent }] }],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 1200,
      responseMimeType: 'application/json',
    },
  }, apiKey, retries);

  const data = await res.json();
  const raw = data?.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? '')
    .join('')
    .trim();
  if (!raw) throw new Error('Gemini yanıtı boş döndü');

  const parsed = JSON.parse(raw);
  if (!parsed.headline || !parsed.body) {
    throw new Error('Gemini yanıtı beklenen alanları içermiyor');
  }
  return {
    headline: String(parsed.headline).trim(),
    body: String(parsed.body).trim(),
    imageKeyword: parsed.imageKeyword && String(parsed.imageKeyword).trim().toLowerCase() !== 'null'
      ? String(parsed.imageKeyword).trim()
      : null,
    highlights: Array.isArray(parsed.highlights)
      ? parsed.highlights.map((h) => String(h).trim()).filter(Boolean).slice(0, 3)
      : [],
  };
}

const HIGHLIGHTS_PROMPT = `Sana zaten yayınlanmış bir haberin tam metni verilecek. Bu metnin en
can alıcı 3 noktasını, her biri tek ve kısa bir cümle (en fazla ~110 karakter) olacak şekilde
özetle. Cümleler metindeki cümlelerin birebir kopyası olmasın, kendi kısa ifaden olsun; metinde
olmayan hiçbir bilgi uydurma. Metin çok kısaysa 1-2 öğe de yeterli.
Sadece şu JSON şemasında cevap ver: {"highlights": ["...", "...", "..."]}`;

export async function generateHighlights(body, apiKey, retries = 3) {
  const res = await generateContent({
    systemInstruction: { parts: [{ text: HIGHLIGHTS_PROMPT }] },
    contents: [{ role: 'user', parts: [{ text: body }] }],
    generationConfig: {
      temperature: 0.5,
      maxOutputTokens: 400,
      responseMimeType: 'application/json',
    },
  }, apiKey, retries);

  const data = await res.json();
  const raw = data?.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? '')
    .join('')
    .trim();
  if (!raw) throw new Error('Gemini yanıtı boş döndü');
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed.highlights)
    ? parsed.highlights.map((h) => String(h).trim()).filter(Boolean).slice(0, 3)
    : [];
}
