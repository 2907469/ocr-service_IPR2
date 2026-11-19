// Должен подключаться ПЕРВЫМ (до express), чтобы Sentry мог инструментировать модули.
const Sentry = require('@sentry/node');
const config = require('./config');
const { redact } = require('./utils/redact');

if (config.sentryDsn) {
  Sentry.init({
    dsn: config.sentryDsn,
    environment: config.env,
    release: config.release,
    sendDefaultPii: false,
    tracesSampleRate: 0.1,
    beforeSend(event) {
      if (event.request) {
        delete event.request.cookies;
        delete event.request.data;
        if (event.request.headers) event.request.headers = redact(event.request.headers);
      }
      return redact(event);
    },
  });
}

module.exports = Sentry;
