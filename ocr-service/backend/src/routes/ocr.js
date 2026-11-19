const path = require('path');
const express = require('express');
const multer = require('multer');
const rateLimit = require('express-rate-limit');
const config = require('../config');
const logger = require('../logger');
const metrics = require('../metrics');
const { httpError } = require('../utils/httpError');
const { ALLOWED_LANGS, detectImageType } = require('../utils/validators');

function parseId(raw) {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw httpError(400, 'Некорректный id');
  return id;
}

function createOcrRouter({ store, ocr }) {
  const router = express.Router();

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: config.maxFileMb * 1024 * 1024, files: 1 },
  });

  const limiter = rateLimit({
    windowMs: 60 * 1000,
    limit: config.rateLimitPerMin,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: { message: 'Слишком много запросов, попробуйте позже' } },
  });

  // POST /api/ocr — распознать текст на изображении
  router.post('/', limiter, upload.single('image'), async (req, res, next) => {
    try {
      if (!req.file) throw httpError(400, 'Файл не передан: используйте поле формы "image"');
      const lang = String(req.body.lang || 'eng');
      if (!ALLOWED_LANGS.includes(lang)) {
        throw httpError(400, `Недопустимый язык. Доступно: ${ALLOWED_LANGS.join(', ')}`);
      }
      const mimeType = detectImageType(req.file.buffer);
      if (!mimeType) throw httpError(415, 'Неподдерживаемый формат: нужен PNG, JPEG, WEBP или BMP');

      const started = Date.now();
      let result;
      try {
        result = await ocr.recognize(req.file.buffer, lang);
      } catch (err) {
        metrics.recordOcr(Date.now() - started, false);
        throw err;
      }
      const durationMs = Date.now() - started;
      metrics.recordOcr(durationMs, true);

      const saved = await store.save({
        filename: path.basename(req.file.originalname || 'image').slice(0, 200),
        mimeType,
        sizeBytes: req.file.size,
        language: lang,
        text: result.text,
        confidence: result.confidence,
        durationMs,
      });

      // В лог НЕ пишем распознанный текст и имя файла — только технические поля.
      logger.info('ocr_completed', {
        id: saved.id,
        sizeBytes: saved.sizeBytes,
        language: lang,
        durationMs,
        chars: result.text.length,
        confidence: result.confidence,
      });
      res.status(201).json(saved);
    } catch (err) {
      next(err);
    }
  });

  // GET /api/ocr?limit=20&offset=0 — история распознаваний
  router.get('/', async (req, res, next) => {
    try {
      const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
      const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
      const [items, total] = await Promise.all([store.list(limit, offset), store.count()]);
      res.json({ items, total, limit, offset });
    } catch (err) {
      next(err);
    }
  });

  router.get('/:id', async (req, res, next) => {
    try {
      const item = await store.get(parseId(req.params.id));
      if (!item) throw httpError(404, 'Результат не найден');
      res.json(item);
    } catch (err) {
      next(err);
    }
  });

  router.delete('/:id', async (req, res, next) => {
    try {
      const removed = await store.remove(parseId(req.params.id));
      if (!removed) throw httpError(404, 'Результат не найден');
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  return router;
}

module.exports = { createOcrRouter };
