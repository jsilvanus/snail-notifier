'use strict';

/** Lazy singleton — Twilio client is only instantiated when first needed. */
let _client = null;

function getTwilioClient() {
  if (!_client) {
    const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } = process.env;
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
      throw new Error('Twilio credentials not configured');
    }
    _client = require('twilio')(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  }
  return _client;
}

module.exports = { getTwilioClient };
