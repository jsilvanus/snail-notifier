import { getTwilioClient } from './twilio-client.js';

async function sendWhatsApp(to, body) {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
    console.log(`[whatsapp stub] To: ${to} | Body: ${body}`);
    return;
  }
  const client = await getTwilioClient();
  await client.messages.create({
    body,
    from: `whatsapp:${process.env.TWILIO_WHATSAPP_FROM}`,
    to: `whatsapp:${to}`,
  });
}

export { sendWhatsApp };
