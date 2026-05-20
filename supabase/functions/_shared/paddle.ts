import { Environment, Paddle, EventName } from 'npm:@paddle/paddle-node-sdk';

const getEnv = (key: string): string => {
  const value = Deno.env.get(key);
  if (!value) throw new Error(`${key} is not configured`);
  return value;
};

export { EventName };

export type PaddleEnv = 'sandbox' | 'live';

const GATEWAY_BASE_URL = 'https://connector-gateway.lovable.dev/paddle';

export function getConnectionApiKey(env: PaddleEnv): string {
  return env === 'sandbox' ? getEnv('PADDLE_SANDBOX_API_KEY') : getEnv('PADDLE_LIVE_API_KEY');
}

export function getPaddleClient(env: PaddleEnv): Paddle {
  const connectionApiKey = getConnectionApiKey(env);
  const lovableApiKey = getEnv('LOVABLE_API_KEY');
  return new Paddle(connectionApiKey, {
    environment: GATEWAY_BASE_URL as unknown as Environment,
    customHeaders: {
      'X-Connection-Api-Key': connectionApiKey,
      'Lovable-API-Key': lovableApiKey,
    },
  });
}

export async function gatewayFetch(env: PaddleEnv, path: string, init?: RequestInit): Promise<Response> {
  const connectionApiKey = getConnectionApiKey(env);
  const lovableApiKey = getEnv('LOVABLE_API_KEY');
  return fetch(`${GATEWAY_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'X-Connection-Api-Key': connectionApiKey,
      'Lovable-API-Key': lovableApiKey,
      ...init?.headers,
    },
  });
}

export function getWebhookSecret(env: PaddleEnv): string {
  return env === 'sandbox' ? getEnv('PAYMENTS_SANDBOX_WEBHOOK_SECRET') : getEnv('PAYMENTS_LIVE_WEBHOOK_SECRET');
}

export async function verifyWebhook(req: Request, env: PaddleEnv) {
  const signature = req.headers.get('paddle-signature');
  const body = await req.text();
  const secret = getWebhookSecret(env);
  if (!signature || !body) throw new Error('Missing signature or body');
  const paddle = getPaddleClient(env);
  return await paddle.webhooks.unmarshal(body, secret, signature);
}

/**
 * Verify a webhook by trying both live and sandbox secrets server-side.
 * The environment is determined by which secret successfully validates the
 * signature — an attacker cannot select the env via query string, because
 * forging a valid signature requires the real Paddle webhook secret.
 */
export async function verifyWebhookAuto(req: Request): Promise<{ event: any; env: PaddleEnv }> {
  const signature = req.headers.get('paddle-signature');
  const body = await req.text();
  if (!signature || !body) throw new Error('Missing signature or body');

  const envs: PaddleEnv[] = ['live', 'sandbox'];
  let lastErr: unknown;
  for (const env of envs) {
    try {
      const secret = getWebhookSecret(env);
      const paddle = getPaddleClient(env);
      const event = await paddle.webhooks.unmarshal(body, secret, signature);
      return { event, env };
    } catch (e) {
      lastErr = e;
    }
  }
  throw new Error(`Webhook signature verification failed: ${lastErr}`);
}

