const path = require('path');
const crypto = require('crypto');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const Sentry = require('./instrument');
const config = require('./config');
const logger = require('./logger');
const metrics = require('./metrics');
const { alertCritical } = require('./telegram');
const { createOcrRouter } = require('./routes/ocr');
const { httpError } = require('./utils/httpError');

const publicDir = path.join(__dirname, '..', 'public');

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);
}

function createApp({ store, ocr }) {
  const app = express();
  app.set('trust proxy', 1); // за прокси Render, чтобы корректно работали rate limit и IP
  app.disable('x-powered-by');

  app.use(helmet());
  app.use(metrics.middleware);

  // request id + access log (без /health, чтобы не засорять логи пингами мониторинга)
  app.use((req, res, next) => {
    req.id = crypto.randomUUID();
    res.setHeader('X-Request-Id', req.id);
    const start = Date.now();
    res.on('finish', () => {
      if (req.path === '/health') return;
      const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
      logger.log(level, 'http_request', {
        requestId: req.id,
        method: req.method,
        path: req.path,
        status: res.statusCode,
        durationMs: Date.now() - start,
      });
    });
    next();
  });

  app.use(
    cors({
      origin: (origin, cb) => cb(null, !origin || config.corsOrigins.includes(origin)),
      methods: ['GET', 'POST', 'DELETE'],
    })
  );
  app.use(express.json({ limit: '100kb' }));

  // ---- служебные эндпоинты ----
  app.get('/health', async (_req, res) => {
    let db = 'ok';
    try {
      await withTimeout(store.ping(), 5000);
    } catch {
      db = 'down';
    }
    const ok = db === 'ok';
    res.status(ok ? 200 : 503).json({
      status: ok ? 'ok' : 'degraded',
      db,
      store: store.kind,
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/metrics', async (_req, res) => {
    const data = metrics.snapshot();
    try {
      data.storedResults = await withTimeout(store.count(), 3000);
    } catch {
      data.storedResults = null;
    }
    res.json(data);
  });

  app.get('/dashboard', (_req, res) => res.sendFile(path.join(publicDir, 'dashboard.html')));
  app.use('/static', express.static(publicDir));

  // Служебный эндпоинт для проверки Sentry (требует токен, иначе 404).
  app.get('/debug-sentry', (req, _res) => {
    if (!config.adminToken || req.get('x-admin-token') !== config.adminToken) {
      throw httpError(404, 'Not found');
    }
    throw new Error('Sentry backend test error');
  });

  // ---- API ----
  app.use('/api/ocr', createOcrRouter({ store, ocr }));

  app.get('/', (_req, res) => {
    res.json({ name: 'OCR service API', endpoints: ['/api/ocr', '/health', '/metrics', '/dashboard'] });
  });

  app.use((_req, _res, next) => next(httpError(404, 'Not found')));

  // Sentry собирает только необработанные ошибки (5xx)
  Sentry.setupExpressErrorHandler(app);

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, _next) => {
    let status = err.status || 500;
    let message = err.expose ? err.message : 'Внутренняя ошибка сервера';
    if (err.code === 'LIMIT_FILE_SIZE') {
      status = 413;
      message = `Файл слишком большой (максимум ${config.maxFileMb} МБ)`;
    } else if (err.name === 'MulterError') {
      status = 400;
      message = 'Ошибка загрузки файла';
    } else if (err.type === 'entity.parse.failed') {
      status = 400;
      message = 'Некорректный JSON';
    }

    if (status >= 500) {
      logger.error('unhandled_error', { requestId: req.id, path: req.path, error: err });
      alertCritical(`OCR backend: ошибка 500 на ${req.method} ${req.path}\n${String(err.message).slice(0, 200)}`);
    }
    res.status(status).json({ error: { message, requestId: req.id } });
  });

  return app;
}

module.exports = { createApp };
