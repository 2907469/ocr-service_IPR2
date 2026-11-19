require('./instrument');
const config = require('./config');
const logger = require('./logger');
const Sentry = require('@sentry/node');
const { createStore } = require('./db/store');
const ocr = require('./services/ocr');
const { createApp } = require('./app');
const { notifyTelegram, alertCritical } = require('./telegram');

async function main() {
  const store = createStore();
  await store.init();

  const app = createApp({ store, ocr });
  const server = app.listen(config.port, () => {
    logger.info('server_started', { port: config.port, store: store.kind });
    if (config.notifyOnStart) notifyTelegram(`✅ OCR backend запущен (${config.env}, store=${store.kind})`);
  });

  let shuttingDown = false;
  async function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info('shutdown_started', { signal });
    server.close(async () => {
      await ocr.shutdown().catch(() => {});
      await store.close().catch(() => {});
      await logger.flushLogs().catch(() => {});
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  }
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

process.on('unhandledRejection', (reason) => {
  logger.error('unhandled_rejection', { error: reason });
  Sentry.captureException(reason);
});

process.on('uncaughtException', async (err) => {
  logger.error('uncaught_exception', { error: err });
  Sentry.captureException(err);
  await alertCritical(`OCR backend упал: ${String(err.message).slice(0, 200)}`);
  await Sentry.flush(2000).catch(() => {});
  await logger.flushLogs().catch(() => {});
  process.exit(1);
});

main().catch(async (err) => {
  logger.error('startup_failed', { error: err });
  Sentry.captureException(err);
  await alertCritical(`OCR backend не запустился: ${String(err.message).slice(0, 200)}`);
  await Sentry.flush(2000).catch(() => {});
  await logger.flushLogs().catch(() => {});
  process.exit(1);
});
