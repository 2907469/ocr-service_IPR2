const winston = require('winston');
const config = require('./config');
const { redact } = require('./utils/redact');

const RESERVED = new Set(['level', 'message', 'timestamp', 'service']);

const redactFormat = winston.format((info) => {
  for (const key of Object.keys(info)) {
    if (!RESERVED.has(key)) info[key] = redact(info[key]);
  }
  if (typeof info.message === 'string') info.message = redact(info.message);
  return info;
});

const transports = [
  new winston.transports.Console({
    silent: config.env === 'test',
    format:
      config.env === 'production'
        ? winston.format.json()
        : winston.format.combine(winston.format.colorize(), winston.format.simple()),
  }),
];

let logtail = null;
if (config.logtailToken) {
  const { Logtail } = require('@logtail/node');
  const { LogtailTransport } = require('@logtail/winston');
  logtail = new Logtail(config.logtailToken, config.logtailEndpoint ? { endpoint: config.logtailEndpoint } : undefined);
  transports.push(new LogtailTransport(logtail));
}

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  defaultMeta: { service: 'ocr-backend', env: config.env },
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    redactFormat()
  ),
  transports,
});

async function flushLogs() {
  if (logtail) await logtail.flush();
}

module.exports = logger;
module.exports.flushLogs = flushLogs;
