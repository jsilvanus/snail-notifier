async function sendTelegram(chatId, text) {
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    console.log(`[telegram stub] Chat: ${chatId} | Text: ${text}`);
    return;
  }
  const res = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
  if (!res.ok) throw new Error(`Telegram API error: ${res.status}`);
}

export { sendTelegram };
