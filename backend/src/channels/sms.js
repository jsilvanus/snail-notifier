'use strict';

const { getTwilioClient } = require('./twilio-client');

async function sendSms(to, body) {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
    console.log(`[sms stub] To: ${to} | Body: ${body}`);
    return;
  }
  await getTwilioClient().messages.create({ body, from: process.env.TWILIO_PHONE_FROM, to });
}

module.exports = { sendSms };
