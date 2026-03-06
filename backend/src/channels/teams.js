/**
 * Microsoft Teams channel adapter.
 *
 * Requires environment variables:
 *   TEAMS_WEBHOOK_URL – Incoming Webhook URL from Teams channel configuration
 */

/**
 * Send a Microsoft Teams notification via Incoming Webhook using an Adaptive Card.
 * Uses JSON.stringify on a proper object to avoid malformed JSON if message
 * contains special characters such as quotes.
 *
 * @param {string} webhookUrl – Override per-notification; falls back to env var
 * @param {string} message    – Plain-text notification body
 * @param {string} [title]    – Optional card title
 * @returns {Promise<void>}
 */
export async function send(webhookUrl, message, title = 'Snail Notifier') {
  const url = webhookUrl || process.env.TEAMS_WEBHOOK_URL;
  if (!url) {
    throw new Error('TEAMS_WEBHOOK_URL must be set or passed as the first argument');
  }

  const card = {
    type: 'message',
    attachments: [
      {
        contentType: 'application/vnd.microsoft.card.adaptive',
        content: {
          $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
          type: 'AdaptiveCard',
          version: '1.4',
          body: [
            {
              type: 'TextBlock',
              size: 'Medium',
              weight: 'Bolder',
              text: title,
            },
            {
              type: 'TextBlock',
              text: message,
              wrap: true,
            },
          ],
        },
      },
    ],
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(card),
  });

  if (!response.ok) {
    throw new Error(`Teams webhook error: ${response.status} ${response.statusText}`);
  }
}
