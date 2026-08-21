const SEARCH_URL = 'https://api.unsplash.com/search/photos';

/**
 * Bir anahtar kelime için gerçek bir stok fotoğraf bulur. Unsplash API
 * kurallarına uymak için seçilen fotoğrafın download_location endpoint'ini
 * de tetikler (bkz. https://help.unsplash.com/en/articles/2511315).
 * Sonuç bulunamazsa veya key yoksa null döner — çağıran taraf görselsiz
 * devam eder.
 */
export async function findPhoto(keyword, accessKey) {
  if (!accessKey || !keyword) return null;

  const url = new URL(SEARCH_URL);
  url.searchParams.set('query', keyword);
  url.searchParams.set('per_page', '1');
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
  const photo = data?.results?.[0];
  if (!photo) return null;

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
