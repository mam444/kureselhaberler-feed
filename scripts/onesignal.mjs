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
      // article.imageUrl is our own Unsplash-sourced stock photo (see
      // unsplash.mjs), never the original publisher's copyrighted image —
      // safe to redistribute in the push.
      big_picture: article.imageUrl ?? undefined,
      chrome_web_image: article.imageUrl ?? undefined,
      data: { articleId: article.id },
      // Routes into the Flutter app's own "breaking_news" Android channel
      // (created client-side in notification_service.dart) so a real push
      // uses the same custom sound + vibration pattern as an in-app local
      // notification, instead of the OS default. Ignored on platforms/apps
      // where that channel doesn't exist (e.g. web push).
      existing_android_channel_id: 'breaking_news',
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
