import { Hono } from 'hono';
import { Env, WhatsAppWebhook } from './types';
import { handleUpdate } from './bot/handler';
import { upsertWebhookRoute } from './services/whatsapp';

const app = new Hono<{ Bindings: Env }>();

app.post('/webhook/whatsapp/:secret', async (c) => {
  if (c.req.param('secret') !== c.env.WEBHOOK_SECRET) {
    return c.text('Unauthorized', 401);
  }

  const update = await c.req.json<WhatsAppWebhook>();
  const businessPhone = c.req.header('x-zap-gateway-number') ?? undefined;

  c.executionCtx.waitUntil(handleUpdate(c.env, update, businessPhone));

  return c.json({ status: 'received' });
});

app.get('/setup-whatsapp', async (c) => {
  const secret = c.req.query('secret');
  if (secret !== c.env.WEBHOOK_SECRET) {
    return c.text('Unauthorized', 401);
  }

  const phoneNumber = c.req.query('phone') ?? c.env.WHATSAPP_BUSINESS_NUMBER;
  if (!phoneNumber) {
    return c.json({ ok: false, error: 'Missing phone number. Set WHATSAPP_BUSINESS_NUMBER or pass ?phone=' }, 400);
  }

  const url = new URL(c.req.url);
  const webhookUrl = `${url.origin}/webhook/whatsapp/${c.env.WEBHOOK_SECRET}`;
  const ok = await upsertWebhookRoute(c.env, phoneNumber, webhookUrl);

  return c.json({ ok, webhook_url: webhookUrl, phone_number: phoneNumber });
});

app.get('/', (c) => c.text('CalTracker WhatsApp Bot'));

export default {
  fetch: app.fetch,
};
