'use strict';

/** Microsoft Teams via Incoming Webhook — sends an Adaptive Card message. */
async function sendTeams(webhookUrl, title, text) {
  if (!webhookUrl) {
    console.log(`[teams stub] Title: ${title} | Text: ${text}`);
    return;
  }
  const card = {
    type: 'message',
    attachments: [{
      contentType: 'application/vnd.microsoft.card.adaptive',
      content: {
        type: 'AdaptiveCard',
        version: '1.4',
        body: [
          { type: 'TextBlock', size: 'Medium', weight: 'Bolder', text: title },
          { type: 'TextBlock', wrap: true, text },
        ],
      },
    }],
  };
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(card),
  });
  if (!res.ok) throw new Error(`Teams webhook error: ${res.status}`);
}

module.exports = { sendTeams };
