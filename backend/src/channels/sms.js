/**
 * SMS channel adapter.
 *
 * Requires environment variables:
 *   SMS_PROVIDER_URL   – HTTP endpoint of the SMS gateway
 *   SMS_API_KEY        – API key for the gateway
 *   SMS_FROM           – Sender ID / phone number
 */

/**
 * Send an SMS notification.
 * @param {string} to       – Recipient phone number (E.164 format)
 * @param {string} message  – Plain-text message body
 * @param {string} [_title] – Ignored for SMS; accepted for a uniform adapter signature
 * @returns {Promise<object>} – Provider response
 */
export async function send(to, message, _title) {
  const { SMS_PROVIDER_URL, SMS_API_KEY, SMS_FROM } = process.env;
  if (!SMS_PROVIDER_URL || !SMS_API_KEY) {
    throw new Error('SMS_PROVIDER_URL and SMS_API_KEY must be set');
  }

  const response = await fetch(SMS_PROVIDER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SMS_API_KEY}`,
    },
    body: JSON.stringify({ from: SMS_FROM, to, text: message }),
  });

  if (!response.ok) {
    throw new Error(`SMS gateway error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}
