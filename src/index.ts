import { Hono } from 'hono';
import { clearAdminSessionCookie, createAdminSessionCookie, isAdminAuthenticated, verifyAdminPassword } from './admin/auth';
import { renderAdminDashboard, renderAdminLogin } from './admin/dashboard';
import { getAdminMetrics } from './admin/metrics';
import { withDatabase } from './db/client';
import { Bindings, Env, WhatsAppWebhook } from './types';
import { handleUpdate } from './bot/handler';
import { renderStatusCardResponse, verifyStatusCardSignature } from './bot/status-card';
import { upsertWebhookRoute } from './services/whatsapp';

const app = new Hono<{ Bindings: Bindings }>();

app.post('/webhook/whatsapp/:secret', async (c) => {
  const env = withDatabase(c.env);

  if (c.req.param('secret') !== env.WEBHOOK_SECRET) {
    return c.text('Unauthorized', 401);
  }

  const update = await c.req.json<WhatsAppWebhook>();
  const businessPhone = c.req.header('x-zap-gateway-number') ?? undefined;
  const publicOrigin = new URL(c.req.url).origin;

  c.executionCtx.waitUntil(handleUpdate(env, update, businessPhone, publicOrigin));

  return c.json({ status: 'received' });
});

app.get('/status-card/:userId/:date', async (c) => {
  const env = withDatabase(c.env);
  const userId = Number.parseInt(c.req.param('userId'), 10);
  const date = c.req.param('date');
  const viewQuery = c.req.query('view');
  const view: 'day' | 'week' | 'month' = viewQuery === 'week' || viewQuery === 'month' ? viewQuery : 'day';
  const expires = c.req.query('expires');
  const signature = c.req.query('sig');
  const isAuthorized = await verifyStatusCardSignature(env.WEBHOOK_SECRET, userId, date, view, expires, signature);

  if (!isAuthorized) {
    return c.text('Unauthorized', 401);
  }

  return renderStatusCardResponse(env, userId, date, view);
});

app.get('/setup-whatsapp', async (c) => {
  const env = withDatabase(c.env);
  const secret = c.req.query('secret');
  if (secret !== env.WEBHOOK_SECRET) {
    return c.text('Unauthorized', 401);
  }

  const phoneNumber = c.req.query('phone') ?? env.WHATSAPP_BUSINESS_NUMBER;
  if (!phoneNumber) {
    return c.json({ ok: false, error: 'Missing phone number. Set WHATSAPP_BUSINESS_NUMBER or pass ?phone=' }, 400);
  }

  const url = new URL(c.req.url);
  const webhookUrl = `${url.origin}/webhook/whatsapp/${env.WEBHOOK_SECRET}`;
  const ok = await upsertWebhookRoute(env, phoneNumber, webhookUrl);

  return c.json({ ok, webhook_url: webhookUrl, phone_number: phoneNumber });
});

app.get('/admin', async (c) => {
  const env = withDatabase(c.env);
  const authenticated = await isAdminAuthenticated(env, c.req.header('cookie'));
  if (!authenticated) {
    return c.html(renderAdminLogin());
  }

  const metrics = await getAdminMetrics(env.DB);
  return c.html(renderAdminDashboard(metrics));
});

app.post('/admin/login', async (c) => {
  const env = withDatabase(c.env);
  const formData = await c.req.formData();
  const password = formData.get('password');

  if (!verifyAdminPassword(env, typeof password === 'string' ? password : null)) {
    return c.html(renderAdminLogin('Invalid password.'), 401);
  }

  const cookie = await createAdminSessionCookie(env);
  c.header('Set-Cookie', cookie);
  return c.redirect('/admin');
});

app.post('/admin/logout', async (c) => {
  c.header('Set-Cookie', clearAdminSessionCookie());
  return c.redirect('/admin');
});

app.get('/admin/api/summary', async (c) => {
  const env = withDatabase(c.env);
  const authenticated = await isAdminAuthenticated(env, c.req.header('cookie'));
  if (!authenticated) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const metrics = await getAdminMetrics(env.DB);
  return c.json(metrics);
});

app.get('/', (c) => c.text('CalTracker WhatsApp Bot'));

export default {
  fetch: app.fetch,
};
