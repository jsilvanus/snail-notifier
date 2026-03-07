'use strict';

const { getTwilioClient } = require('./twilio-client');

async function sendWhatsApp(to, body) {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
    console.log(`[whatsapp stub] To: ${to} | Body: ${body}`);
    return;
  }
  await getTwilioClient().messages.create({
    body,
    from: `whatsapp:${process.env.TWILIO_WHATSAPP_FROM}`,
    to: `whatsapp:${to}`,
  });
}

module.exports = { sendWhatsApp };
