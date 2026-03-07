import { getTwilioClient } from './twilio-client.js';

async function sendSms(to, body) {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
    console.log(`[sms stub] To: ${to} | Body: ${body}`);
    return;
  }
  const client = await getTwilioClient();
  await client.messages.create({ body, from: process.env.TWILIO_PHONE_FROM, to });
}

export { sendSms };
