/** Lazy singleton — Twilio client is only instantiated when first needed. */
let _client = null;

async function getTwilioClient() {
  if (!_client) {
    const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN } = process.env;
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
      throw new Error('Twilio credentials not configured');
    }
    const { default: twilio } = await import('twilio');
    _client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  }
  return _client;
}

export { getTwilioClient };
