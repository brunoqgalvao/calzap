# Cal Tracker for WhatsApp

Cloudflare Worker that runs a Portuguese calorie-tracking assistant on WhatsApp.

## What it does

- Receives WhatsApp webhooks forwarded by Zap Gateway
- Accepts text, image, and audio meal input
- Uses OpenAI to estimate calories from text or photos
- Transcribes audio before sending it through the same nutrition assistant flow
- Stores users, meals, and conversation history in Cloudflare D1
- Stores uploaded meal photos in Cloudflare R2

## Required secrets

Set these with `wrangler secret put`:

- `OPENAI_API_KEY`
- `WEBHOOK_SECRET`
- `ZAP_GATEWAY_API_KEY`
- `ADMIN_PHONE_NUMBER`

Optional:

- `WHATSAPP_BUSINESS_NUMBER`
- `ZAP_GATEWAY_BASE_URL`

## Local commands

```bash
bun install
npm run typecheck
npm run dev
```

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
