const TOPIC = 'kuresel_haberler';

/** Sends one Android push to the app's FCM topic. */
export async function sendAndroidPush(article, accessToken, projectId) {
  if (!accessToken || !projectId) {
    throw new Error('[fcm] GitHub OIDC FCM erişim belirteci yok; Android bildirimi gönderilemedi.');
  }
  const imageUrl = article.imageUrl || undefined;
  const url = `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/messages:send`;
  const payload = JSON.stringify({
    message: {
      topic: TOPIC,
      // Send data-only so Flutter's background handler can save the item
      // in the in-app notification center before showing the OS alert.
      data: {
        articleId: String(article.id),
        // The notification is branded as our app. The article ID still
        // resolves to its original publisher and source link in the reader.
        source: 'Küresel Haberler',
        headline: String(article.headline || ''),
        ...(article.externalUrl ? { externalUrl: String(article.externalUrl) } : {}),
        ...(imageUrl ? { imageUrl: String(imageUrl) } : {}),
      },
      android: { priority: 'HIGH' },
    },
  });

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: payload,
        signal: AbortSignal.timeout(15_000),
      });
      const body = await response.json();
      if (response.ok && body.name) {
        console.log(`[fcm] Android bildirimi kabul edildi: ${body.name}`);
        return;
      }
      const error = new Error(`FCM send failed (${response.status}): ${JSON.stringify(body)}`);
      error.retryable = response.status === 429 || response.status >= 500;
      throw error;
    } catch (error) {
      if (attempt === 3 || error.retryable === false) throw error;
      const delayMs = 1000 * (2 ** (attempt - 1));
      console.warn(`[fcm] ${error.message}; ${delayMs} ms sonra yeniden denenecek (${attempt}/3).`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}
