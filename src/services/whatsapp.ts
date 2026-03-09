import { Env } from '../types';
import { DEFAULT_ZAP_GATEWAY_URL } from '../utils/constants';
import { normalizePhoneNumber } from '../utils/whatsapp';

function gatewayBaseUrl(env: Env): string {
  return env.ZAP_GATEWAY_BASE_URL ?? DEFAULT_ZAP_GATEWAY_URL;
}

export async function sendMessage(
  env: Env,
  from: string,
  to: string,
  text: string,
  replyToMessageId?: string,
): Promise<void> {
  const body: Record<string, unknown> = {
    from: normalizePhoneNumber(from),
    to: normalizePhoneNumber(to),
    type: 'text',
    text: { body: text },
  };

  if (replyToMessageId) {
    body.context = { message_id: replyToMessageId };
  }

  const response = await fetch(`${gatewayBaseUrl(env)}/api/send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.ZAP_GATEWAY_API_KEY,
    },
    body: JSON.stringify(body),
  });

  if (response.ok) {
    return;
  }

  throw new Error(`WhatsApp send failed: ${response.status} ${await response.text()}`);
}

export async function downloadMedia(
  env: Env,
  mediaId: string,
  businessPhone: string,
): Promise<{ data: ArrayBuffer; contentType: string }> {
  const url = new URL(`${gatewayBaseUrl(env)}/api/media/${encodeURIComponent(mediaId)}`);
  url.searchParams.set('phone', normalizePhoneNumber(businessPhone));

  const response = await fetch(url.toString(), {
    headers: {
      'x-api-key': env.ZAP_GATEWAY_API_KEY,
    },
  });

  if (!response.ok) {
    throw new Error(`WhatsApp media download failed: ${response.status} ${await response.text()}`);
  }

  return {
    data: await response.arrayBuffer(),
    contentType: response.headers.get('content-type') ?? 'application/octet-stream',
  };
}

export async function upsertWebhookRoute(
  env: Env,
  phoneNumber: string,
  targetUrl: string,
): Promise<boolean> {
  const response = await fetch(`${gatewayBaseUrl(env)}/api/routes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.ZAP_GATEWAY_API_KEY,
    },
    body: JSON.stringify({
      phoneNumber: normalizePhoneNumber(phoneNumber),
      targetUrl,
    }),
  });

  return response.ok;
}
