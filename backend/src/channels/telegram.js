/**
 * Telegram channel adapter.
 *
 * Requires environment variables:
 *   TELEGRAM_BOT_TOKEN – Token from BotFather
 */

const TELEGRAM_API_BASE = 'https://api.telegram.org';

/**
 * Send a Telegram message.
 * @param {string|number} chatId  – Recipient chat ID
 * @param {string}        message – Message text (supports Markdown)
 * @param {string}        [_title] – Ignored for Telegram; accepted for a uniform adapter signature
 * @returns {Promise<object>} – Telegram API response
 */
export async function send(chatId, message, _title) {
  const { TELEGRAM_BOT_TOKEN } = process.env;
  if (!TELEGRAM_BOT_TOKEN) {
    throw new Error('TELEGRAM_BOT_TOKEN must be set');
  }

  const url = `${TELEGRAM_API_BASE}/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'Markdown' }),
  });

  if (!response.ok) {
    throw new Error(`Telegram API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}
