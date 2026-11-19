const config = require('./config');
const logger = require('./logger');

const THROTTLE_MS = 60 * 1000;
let lastAlertAt = 0;

async function notifyTelegram(text) {
  if (!config.telegramToken || !config.telegramChatId) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${config.telegramToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: config.telegramChatId, text }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) logger.warn('telegram_send_failed', { status: res.status });
    return res.ok;
  } catch (err) {
    logger.warn('telegram_send_error', { error: err.message });
    return false;
  }
}

// Критические алерты не чаще раза в минуту, чтобы не засыпать чат.
async function alertCritical(text) {
  const now = Date.now();
  if (now - lastAlertAt < THROTTLE_MS) return false;
  lastAlertAt = now;
  return notifyTelegram(`🚨 ${text}`);
}

module.exports = { notifyTelegram, alertCritical };
