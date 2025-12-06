# WhatsApp Convocation Registration

## Overview
WhatsApp Cloud API + Node.js backend.
Saves registrations to MongoDB and logs to Google Sheets.

## Setup
1. Clone repo
2. `npm install`
3. Create Google service account, grant Sheets edit permission to service account email, and copy sheet ID.
4. Set .env values (WHATSAPP_TOKEN, PHONE_NUMBER_ID, VERIFY_TOKEN, MONGO_URI, GOOGLE_*).
5. Start server: `npm run dev` or `npm start`.

## Webhook
- Set your webhook URL (e.g., https://your-domain.com/webhook) in Facebook App settings.
- Verify with the same VERIFY_TOKEN value.

## WhatsApp messages
- When a user messages your number, the bot starts the registration flow (one question at a time).
- If the phone number is already registered and user sends *Hi* or *Register*, the bot returns their registration details.
- Reply `UPDATE` to start editing their registration.

## Production notes
- Replace in-memory session store with Redis for reliability.
- Secure .env and Google private key.
- Use HTTPS and a valid domain for the webhook.
