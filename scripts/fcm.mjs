import { createSign } from 'node:crypto';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const MESSAGING_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';
const TOPIC = 'kuresel_haberler';

function base64Url(value) {
  return Buffer.from(value).toString('base64url');
}

function createAssertion({ client_email, private_key }) {
  if (!client_email || !private_key) {
    throw new Error('Firebase service account JSON must include client_email and private_key.');
  }

  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64Url(JSON.stringify({
    iss: client_email,
    scope: MESSAGING_SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  }));
  const unsigned = `${header}.${claims}`;
  const signer = createSign('RSA-SHA256');
  signer.update(unsigned);
  signer.end();
  return `${unsigned}.${signer.sign(private_key).toString('base64url')}`;
}

async function getAccessToken(serviceAccount) {
  const assertion = createAssertion(serviceAccount);
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const body = await response.json();
  if (!response.ok || !body.access_token) {
    throw new Error(`OAuth token request failed (${response.status}): ${JSON.stringify(body)}`);
  }
  return body.access_token;
}

/** Sends one Android push to the app's FCM topic. */
export async function sendAndroidPush(article, serviceAccountJson) {
  if (!serviceAccountJson) {
    console.warn('[fcm] FIREBASE_SERVICE_ACCOUNT_JSON yok; Android bildirimi atlandı.');
    return;
  }

  let serviceAccount;
  try {
    serviceAccount = JSON.parse(serviceAccountJson);
  } catch {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON.');
  }
  if (!serviceAccount.project_id) {
    throw new Error('Firebase service account JSON must include project_id.');
  }

  const accessToken = await getAccessToken(serviceAccount);
  const imageUrl = article.imageUrl || undefined;
  const response = await fetch(
    `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(serviceAccount.project_id)}/messages:send`,
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
