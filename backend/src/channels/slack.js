async function sendSlack(webhookUrl, text) {
  if (!webhookUrl) {
    console.log(`[slack stub] Text: ${text}`);
    return;
  }
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) throw new Error(`Slack webhook error: ${res.status}`);
}

export { sendSlack };
