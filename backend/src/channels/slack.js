/**
 * Slack channel adapter.
 *
 * Requires environment variables:
 *   SLACK_WEBHOOK_URL – Incoming Webhook URL from Slack app configuration
 */

/**
 * Send a Slack notification via Incoming Webhook.
 * @param {string} target  – Webhook URL; falls back to SLACK_WEBHOOK_URL env var
 * @param {string} message – Message text (supports mrkdwn)
 * @param {string} [_title] – Ignored for Slack; accepted for a uniform adapter signature
 * @returns {Promise<void>}
 */
export async function send(target, message, _title) {
  const url = target || process.env.SLACK_WEBHOOK_URL;
  if (!url) {
    throw new Error('SLACK_WEBHOOK_URL must be set or passed as the first argument');
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: message }),
  });

  if (!response.ok) {
    throw new Error(`Slack webhook error: ${response.status} ${response.statusText}`);
  }
}
