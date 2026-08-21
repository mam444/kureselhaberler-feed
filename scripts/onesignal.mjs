const NOTIFICATIONS_URL = 'https://onesignal.com/api/v1/notifications';

/** Yeni yayınlanan bir haber için tüm abonelere tek bir push bildirimi gönderir. */
export async function sendNewArticleNotification(article, { appId, restApiKey }) {
  if (!appId || !restApiKey) {
    console.log('[onesignal] ONESIGNAL_APP_ID / ONESIGNAL_REST_API_KEY yok, bildirim atlanıyor');
    return;
  }

  const res = await fetch(NOTIFICATIONS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Key ${restApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      app_id: appId,
      included_segments: ['Subscribed Users'],
      headings: { tr: article.source, en: article.source },
      contents: { tr: article.headline, en: article.headline },
      url: article.externalUrl ?? undefined,
      data: { articleId: article.id },
    }),
    signal: AbortSignal.timeout(15_000),
  });

  const body = await res.json();
  if (!res.ok || body.errors) {
    console.warn(`[onesignal] bildirim gönderilemedi (${res.status}): ${JSON.stringify(body)}`);
  } else {
    console.log(`[onesignal] bildirim gönderildi: ${article.headline}`);
  }
}
