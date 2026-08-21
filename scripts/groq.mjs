const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'openai/gpt-oss-120b';

const SYSTEM_PROMPT = `Sen deneyimli bir haber editörüsün. Sana bir olayın başlığı ve kısa bir özeti
verilecek. Görevin, bunu gerçek bir haber sitesinde yayınlanacak kalitede, akıcı ve tam bir haber
metnine dönüştürmek — kaynağı özetleyen tek bir paragraf değil, doğru habercilik biçiminde
yazılmış bir metin.

KURALLAR:
1. İçindeki kişi isimlerini, yer isimlerini, sayıları, tarihleri ve olay gerçeklerini KORU.
   Kaynağı kelime kelime veya cümle cümle kopyalama; tamamen farklı cümle yapısı, farklı cümle
   SIRASI ve kendi kelime seçiminle yeniden yaz.
2. HİÇBİR yeni bilgi, tahmin, alıntı, istatistik veya gerçek kişiler hakkında kaynakta olmayan
   hiçbir iddia UYDURMA. Sadece sana verilen bilgiyi daha akıcı ve profesyonel bir dille yeniden
   ifade et ve doğal habercilik bağlam cümleleriyle (örn. "Olay, ... sırasında meydana geldi.")
   çevrele — ama hiçbir zaman somut bir detay (isim, sayı, konum, alıntı) icat etme.
3. Kaynak metin zenginse (birden fazla olgu/ayrıntı içeriyorsa), gerçek bir haber sitesi gibi
   2-3 paragraflık, giriş cümlesi olayın özünü veren ("inverted pyramid") bir yapı kur. Kaynak
   metin çok kısaysa (tek cümlelik bir özetse), metni de kısa tut — dolgu cümlelerle veya
   uydurma ayrıntıyla YAPAY olarak uzatma. Uzunluk her zaman kaynaktaki gerçek bilgi miktarına
   göre belirlenir, asla sabit bir hedefe göre değil.
4. Türkçe yaz (haber İngilizce ise Türkçeye çevirip özgün cümlelerle yaz). Paragrafları "\\n\\n"
   ile ayır.
5. Haberin konusunu özetleyen, İngilizce, Unsplash'ta arama yapmaya uygun, somut ve GERÇEKTE
   FOTOĞRAFLANABİLİR 1-3 kelimelik bir görsel anahtar kelimesi belirle (örn. "stock market",
   "police car", "gold bars", "football stadium"). Soyut kavramlar değil, gerçek nesne/sahne
   tarif et.
6. Kategori üretme; kategori ataması ayrıca yapılıyor.
7. Başlığı normal Türkçe yazım kurallarına uygun, sadece cümle başı ve özel isimler büyük harfle
   başlayan bir biçimde yaz — kaynak başlık TAMAMEN BÜYÜK HARFLE ("SON DAKİKA...", "AÇIKLAMA
   GELDİ" gibi) verilmiş olsa bile, bunu asla olduğu gibi kopyalama; gerçek bir gazetenin normal
   başlık üslubuna çevir.

Sadece şu JSON şemasında cevap ver, başka hiçbir şey yazma:
{"headline": "...", "body": "...", "imageKeyword": "..."}`;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function rewriteArticle({ headline, body, category }, apiKey, retries = 3) {
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
      max_completion_tokens: 900,
      response_format: { type: 'json_object' },
    }),
    signal: AbortSignal.timeout(30_000),
  });

  // Ücretsiz kademenin dakikalık token limitine takılırsa kısa bir bekleme
  // sonrası yeniden dener — art arda birçok haber işlenirken sık karşılaşılır.
  if (res.status === 429 && retries > 0) {
    const body429 = await res.text();
    const waitMatch = /try again in ([\d.]+)s/i.exec(body429);
    const waitMs = waitMatch ? Math.ceil(parseFloat(waitMatch[1]) * 1000) + 300 : 3000;
    console.warn(`[groq] rate limit, ${waitMs}ms bekleniyor (${retries} deneme kaldı)...`);
    await sleep(waitMs);
    return rewriteArticle({ headline, body, category }, apiKey, retries - 1);
  }

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
