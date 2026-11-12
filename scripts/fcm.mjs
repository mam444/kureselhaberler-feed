const TOPIC = 'kuresel_haberler';

/** Sends one Android push to the app's FCM topic. */
export async function sendAndroidPush(article, accessToken, projectId) {
  if (!accessToken || !projectId) {
    console.warn('[fcm] GitHub OIDC FCM erişim belirteci yok; Android bildirimi atlandı.');
    return;
  }
  const imageUrl = article.imageUrl || undefined;
  const response = await fetch(
    `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/messages:send`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          topic: TOPIC,
          // Send data-only so Flutter's background handler can save the item
          // in the in-app notification center before showing the OS alert.
          data: {
            articleId: String(article.id),
            source: String(article.source || 'Küresel Haberler'),
            headline: String(article.headline || ''),
            ...(article.externalUrl ? { externalUrl: String(article.externalUrl) } : {}),
            ...(imageUrl ? { imageUrl: String(imageUrl) } : {}),
          },
          android: {
            priority: 'HIGH',
          },
        },
      }),
      signal: AbortSignal.timeout(15_000),
    },
  );
  const body = await response.json();
  if (!response.ok || !body.name) {
    throw new Error(`FCM send failed (${response.status}): ${JSON.stringify(body)}`);
  }
  console.log(`[fcm] Android bildirimi kabul edildi: ${body.name}`);
}
