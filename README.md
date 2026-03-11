# Cal Tracker for WhatsApp

Cloudflare Worker that runs a Portuguese calorie-tracking assistant on WhatsApp.

## What it does

- Receives WhatsApp webhooks forwarded by Zap Gateway
- Accepts text, image, and audio meal input
- Uses OpenAI to estimate calories, meal type, and macros from text or photos
- Transcribes audio before sending it through the same nutrition assistant flow
- Stores users, meals, weights, and analytics events in Neon Postgres
- Stores uploaded meal photos in Cloudflare R2
- Tracks body weight over time from WhatsApp messages like `meu peso hoje foi 82,4 kg`
- Can send rendered status cards over WhatsApp for daily, weekly, and monthly views
- Exposes a password-protected `/admin` dashboard for growth and cost monitoring
- Records estimated OpenAI spend by model and usage path

## Required secrets

Set these with `wrangler secret put`:

- `OPENAI_API_KEY`
- `WEBHOOK_SECRET`
- `ZAP_GATEWAY_API_KEY`
- `ADMIN_PHONE_NUMBER`
- `NEON_DATABASE_URL`

Optional:

- `ADMIN_DASHBOARD_PASSWORD`
- `WHATSAPP_BUSINESS_NUMBER`
- `ZAP_GATEWAY_BASE_URL`

If `ADMIN_DASHBOARD_PASSWORD` is not set, the admin dashboard defaults to `pqg-bros`.

## Runtime config

- `ACCESS_MODE=open` is the default in [`wrangler.toml`](/Users/brunogalvao/claude-projects/cal/wrangler.toml) so everyone is allowed to use the bot.
- Switch to `ACCESS_MODE=restricted` if you want to re-enable the allowlist flow.

## Local commands

```bash
bun install
bun run typecheck
bun run db:migrate:neon
bun run dev
```

## Neon setup

1. Create a Neon project and copy the pooled connection string into `NEON_DATABASE_URL`.
2. Run `bun run db:migrate:neon`.
3. Deploy the Worker after the schema is created.

## WhatsApp webhook setup

After deploy, register the selected business number in Zap Gateway:

```text
GET /setup-whatsapp?secret=YOUR_WEBHOOK_SECRET&phone=5511999999999
```

That endpoint updates the Zap Gateway route to:

```text
/webhook/whatsapp/YOUR_WEBHOOK_SECRET
```

## Admin commands

- `/permitir 5511999999999`
- `/remover 5511999999999`

Only the phone number configured in `ADMIN_PHONE_NUMBER` can use those commands.
They only matter when `ACCESS_MODE=restricted`.

## Admin dashboard

- URL: `/admin`
- Password: `pqg-bros` unless overridden by `ADMIN_DASHBOARD_PASSWORD`
- JSON feed: `/admin/api/summary`

The dashboard shows:

- total users, active users, inbound volume, and meals logged
- last-14-days growth and AI cost trend
- top users over the last 30 days
- model-level OpenAI usage and estimated spend

## CI/CD

GitHub Actions is set up to:

- run CI on pull requests
- run migrations and deploy to Cloudflare on every push to `main`

Repository secrets required by the deploy workflow:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_REFRESH_TOKEN`
- `OPENAI_API_KEY`
- `WEBHOOK_SECRET`
- `ZAP_GATEWAY_API_KEY`
- `ADMIN_PHONE_NUMBER`
- `WHATSAPP_BUSINESS_NUMBER`
- `ADMIN_DASHBOARD_PASSWORD`
- `NEON_DATABASE_URL`

## Nutrition model

Each meal row now stores:

- `meal_type`: `breakfast`, `lunch`, `dinner`, `snack`
- `total_protein_g`
- `total_carbs_g`
- `total_fat_g`

Older rows created before migration `0006_meal_types_and_macros.sql` will default to `snack` and zeroed macros until they are backfilled or re-logged.

## WhatsApp examples

- `meu peso hoje foi 82,4 kg`
- `qual meu peso atual?`
- `manda um grafico`
- `manda um grafico semanal`
- `manda um grafico mensal`
