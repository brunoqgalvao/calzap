import { recordEvent } from '../analytics/events';
import { Env } from '../types';
import { DEFAULT_ZAP_GATEWAY_URL } from '../utils/constants';
import { normalizePhoneNumber } from '../utils/whatsapp';

interface MessageAnalyticsOptions {
  userId?: number;
  source?: string;
  metadata?: unknown;
}

function gatewayBaseUrl(env: Env): string {
  return env.ZAP_GATEWAY_BASE_URL ?? DEFAULT_ZAP_GATEWAY_URL;
}

export async function sendMessage(
  env: Env,
  from: string,
  to: string,
  text: string,
  replyToMessageId?: string,
  analytics?: MessageAnalyticsOptions,
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
    if (analytics?.userId != null) {
      await recordEvent(env.DB, {
        eventName: 'message.sent',
        userId: analytics.userId,
        phoneNumber: normalizePhoneNumber(to),
        businessPhone: normalizePhoneNumber(from),
        messageType: 'text',
        source: analytics.source ?? 'whatsapp',
        metadata: analytics.metadata,
      });
    }

    return;
  }

  if (analytics?.userId != null) {
    await recordEvent(env.DB, {
      eventName: 'message.sent',
      userId: analytics.userId,
      phoneNumber: normalizePhoneNumber(to),
      businessPhone: normalizePhoneNumber(from),
      messageType: 'text',
      source: analytics.source ?? 'whatsapp',
      status: 'error',
      metadata: {
        ...(typeof analytics.metadata === 'object' && analytics.metadata !== null ? analytics.metadata : {}),
        status: response.status,
      },
    });
  }

  throw new Error(`WhatsApp send failed: ${response.status} ${await response.text()}`);
}

export async function sendImageMessage(
  env: Env,
  from: string,
  to: string,
  imageLink: string,
  caption?: string,
  replyToMessageId?: string,
  analytics?: MessageAnalyticsOptions,
): Promise<void> {
  const body: Record<string, unknown> = {
    from: normalizePhoneNumber(from),
    to: normalizePhoneNumber(to),
    type: 'image',
    image: {
      link: imageLink,
      ...(caption ? { caption } : {}),
    },
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
    if (analytics?.userId != null) {
      await recordEvent(env.DB, {
        eventName: 'message.sent',
        userId: analytics.userId,
        phoneNumber: normalizePhoneNumber(to),
        businessPhone: normalizePhoneNumber(from),
        messageType: 'image',
        source: analytics.source ?? 'status-card',
        metadata: {
          captionLength: caption?.length ?? 0,
          imageLink,
          ...(typeof analytics.metadata === 'object' && analytics.metadata !== null ? analytics.metadata : {}),
        },
      });
    }

    return;
  }

  if (analytics?.userId != null) {
    await recordEvent(env.DB, {
      eventName: 'message.sent',
      userId: analytics.userId,
      phoneNumber: normalizePhoneNumber(to),
      businessPhone: normalizePhoneNumber(from),
      messageType: 'image',
      source: analytics.source ?? 'status-card',
      status: 'error',
      metadata: {
        captionLength: caption?.length ?? 0,
        imageLink,
        status: response.status,
        ...(typeof analytics.metadata === 'object' && analytics.metadata !== null ? analytics.metadata : {}),
      },
    });
  }

  throw new Error(`WhatsApp image send failed: ${response.status} ${await response.text()}`);
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
