const SEARCH_URL = 'https://api.unsplash.com/search/photos';

/**
 * Bir anahtar kelime için gerçek bir stok fotoğraf bulur (ilk birkaç sonuç
 * arasından rastgele seçer, aynı anahtar kelime için hep aynı kare
 * dönmesin diye). Unsplash API kurallarına uymak için seçilen fotoğrafın
 * download_location endpoint'ini de tetikler
 * (bkz. https://help.unsplash.com/en/articles/2511315).
 * Sonuç bulunamazsa veya key yoksa null döner.
 */
async function searchOnce(keyword, accessKey) {
  const url = new URL(SEARCH_URL);
  url.searchParams.set('query', keyword);
  url.searchParams.set('per_page', '5');
  url.searchParams.set('orientation', 'landscape');
  url.searchParams.set('content_filter', 'high');

  const res = await fetch(url, {
    headers: { Authorization: `Client-ID ${accessKey}` },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    console.warn(`[unsplash] arama başarısız (${res.status}): ${keyword}`);
    return null;
  }

  const data = await res.json();
  const results = data?.results ?? [];
  if (results.length === 0) return null;
  const photo = results[Math.floor(Math.random() * results.length)];

  if (photo.links?.download_location) {
    fetch(photo.links.download_location, {
      headers: { Authorization: `Client-ID ${accessKey}` },
    }).catch(() => {});
  }

  return {
    imageUrl: photo.urls?.regular ?? photo.urls?.small ?? null,
    imageCredit: {
      photographer: photo.user?.name ?? null,
      photographerUrl: photo.user?.links?.html ?? null,
      unsplashUrl: photo.links?.html ?? null,
    },
  };
}

/**
 * Bir dizi aday anahtar kelimeyi sırayla dener (ör. AI'ın önerdiği kelime,
 * sonra kategori, sonra genel bir yedek) ve ilk sonuç veren aramayı
 * kullanır — tek bir dar sorgu boş dönerse haber görselsiz kalmasın diye.
 */
export async function findPhoto(candidates, accessKey) {
  if (!accessKey) return null;
  const keywords = (Array.isArray(candidates) ? candidates : [candidates])
    .filter((k) => typeof k === 'string' && k.trim().length > 0);

  for (const keyword of keywords) {
    try {
      const photo = await searchOnce(keyword.trim(), accessKey);
      if (photo) return photo;
    } catch (err) {
      console.warn(`[unsplash] "${keyword}" için hata: ${err.message}`);
    }
  }
  return null;
}
