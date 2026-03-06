/**
 * WhatsApp channel adapter.
 *
 * Uses the WhatsApp Business Cloud API (Meta).
 * Requires environment variables:
 *   WHATSAPP_API_URL    – e.g. https://graph.facebook.com/v18.0/{phone-number-id}/messages
 *   WHATSAPP_API_TOKEN  – Bearer token
 */

/**
 * Send a WhatsApp text message.
 * @param {string} to       – Recipient phone number (E.164 without '+')
 * @param {string} message  – Plain-text message body
 * @param {string} [_title] – Ignored for WhatsApp; accepted for a uniform adapter signature
 * @returns {Promise<object>} – API response
 */
export async function send(to, message, _title) {
  const { WHATSAPP_API_URL, WHATSAPP_API_TOKEN } = process.env;
  if (!WHATSAPP_API_URL || !WHATSAPP_API_TOKEN) {
    throw new Error('WHATSAPP_API_URL and WHATSAPP_API_TOKEN must be set');
  }

  const response = await fetch(WHATSAPP_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${WHATSAPP_API_TOKEN}`,
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: message },
    }),
  });

  if (!response.ok) {
    throw new Error(`WhatsApp API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}
