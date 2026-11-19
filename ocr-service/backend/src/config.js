require('dotenv').config();

const num = (v, d) => {
  if (v === undefined || v === '') return d;
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

module.exports = {
  env: process.env.NODE_ENV || 'development',
  port: num(process.env.PORT, 3000),
  databaseUrl: process.env.DATABASE_URL || '',
  corsOrigins: (process.env.CORS_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  maxFileMb: num(process.env.MAX_FILE_MB, 5),
  rateLimitPerMin: num(process.env.RATE_LIMIT_PER_MIN, 20),
  sentryDsn: process.env.SENTRY_DSN || '',
  logtailToken: process.env.LOGTAIL_SOURCE_TOKEN || '',
  logtailEndpoint: process.env.LOGTAIL_ENDPOINT || '',
  telegramToken: process.env.TELEGRAM_BOT_TOKEN || '',
  telegramChatId: process.env.TELEGRAM_CHAT_ID || '',
  notifyOnStart: process.env.NOTIFY_ON_START === 'true',
  adminToken: process.env.ADMIN_TOKEN || '',
  ocrCachePath: process.env.OCR_CACHE_PATH || '/tmp/tessdata',
  release: process.env.RENDER_GIT_COMMIT || process.env.GIT_COMMIT || undefined,
};
