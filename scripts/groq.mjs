const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'openai/gpt-oss-120b';

const SYSTEM_PROMPT = `Sen bir haber editörüsün. Sana verilen başlık ve özeti, içindeki kişi
isimlerini, yer isimlerini, sayıları ve olay gerçeklerini KORUYARAK, tamamen farklı bir cümle
yapısı ve kelime seçimiyle, kendi cümlelerinle yeniden yaz. Kaynağı kelime kelime kopyalama.
Hiçbir yeni bilgi, tahmin veya yorum uydurma — sadece verilen bilgiyi yeniden ifade et. Türkçe
yaz (haber İngilizce ise Türkçeye çevirip özgün cümlelerle yaz). 2-4 cümlelik kısa bir gövde metni
üret. Ayrıca haberin konusunu özetleyen, İngilizce, Unsplash'ta arama yapmaya uygun 1-3 kelimelik
somut bir görsel anahtar kelimesi belirle (örn. "stock market", "police car", "gold bars").
Kategori üretme; kategori ataması ayrıca yapılıyor.

Sadece şu JSON şemasında cevap ver, başka hiçbir şey yazma:
{"headline": "...", "body": "...", "imageKeyword": "..."}`;

export async function rewriteArticle({ headline, body, category }, apiKey) {
  const userContent = [
    `Başlık: ${headline}`,
    body ? `Özet: ${body}` : null,
    category ? `Kategori (referans amaçlı, değiştirme): ${category}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ],
      temperature: 0.6,
      response_format: { type: 'json_object' },
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    throw new Error(`Groq API ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  const raw = data?.choices?.[0]?.message?.content;
  if (!raw) throw new Error('Groq yanıtı boş döndü');

  const parsed = JSON.parse(raw);
  if (!parsed.headline || !parsed.body) {
    throw new Error('Groq yanıtı beklenen alanları içermiyor');
  }
  return {
    headline: String(parsed.headline).trim(),
    body: String(parsed.body).trim(),
    imageKeyword: parsed.imageKeyword ? String(parsed.imageKeyword).trim() : null,
  };
}
