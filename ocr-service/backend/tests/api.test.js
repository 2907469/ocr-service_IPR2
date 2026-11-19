process.env.NODE_ENV = 'test';
process.env.ADMIN_TOKEN = 'test-admin-token';

const request = require('supertest');
const { createApp } = require('../src/app');
const { createMemoryStore } = require('../src/db/store');
const { redact } = require('../src/utils/redact');
const { detectImageType } = require('../src/utils/validators');

// минимальный валидный PNG-заголовок (достаточно для проверки сигнатуры)
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]);

const fakeOcr = {
  recognize: jest.fn(async () => ({ text: 'Hello OCR', confidence: 91.5 })),
  shutdown: jest.fn(),
};

let app;
beforeEach(() => {
  app = createApp({ store: createMemoryStore(), ocr: fakeOcr });
  fakeOcr.recognize.mockClear();
});

describe('служебные эндпоинты', () => {
  test('GET /health -> 200 и status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.db).toBe('ok');
  });

  test('GET /metrics возвращает uptime, память и счётчики', async () => {
    await request(app).get('/health');
    const res = await request(app).get('/metrics');
    expect(res.status).toBe(200);
    expect(res.body.uptimeSeconds).toBeGreaterThanOrEqual(0);
    expect(res.body.memory.rssMb).toBeGreaterThan(0);
    expect(res.body.requests.total).toBeGreaterThanOrEqual(2);
  });

  test('GET /debug-sentry без токена -> 404', async () => {
    const res = await request(app).get('/debug-sentry');
    expect(res.status).toBe(404);
  });

  test('GET /debug-sentry с токеном -> 500 (тестовая ошибка)', async () => {
    const res = await request(app).get('/debug-sentry').set('x-admin-token', 'test-admin-token');
    expect(res.status).toBe(500);
    expect(res.body.error.message).toBe('Внутренняя ошибка сервера');
  });
});

describe('API /api/ocr', () => {
  test('POST с PNG -> 201 и сохранённый результат', async () => {
    const res = await request(app).post('/api/ocr').attach('image', PNG, 'test.png').field('lang', 'eng');
    expect(res.status).toBe(201);
    expect(res.body.text).toBe('Hello OCR');
    expect(res.body.mimeType).toBe('image/png');
    expect(fakeOcr.recognize).toHaveBeenCalledTimes(1);

    const list = await request(app).get('/api/ocr');
    expect(list.body.total).toBe(1);
  });

  test('POST без файла -> 400', async () => {
    const res = await request(app).post('/api/ocr');
    expect(res.status).toBe(400);
  });

  test('POST с не-изображением -> 415', async () => {
    const res = await request(app).post('/api/ocr').attach('image', Buffer.from('just some text file content'), 'a.png');
    expect(res.status).toBe(415);
    expect(fakeOcr.recognize).not.toHaveBeenCalled();
  });

  test('POST с недопустимым языком -> 400', async () => {
    const res = await request(app).post('/api/ocr').attach('image', PNG, 'a.png').field('lang', 'klingon');
    expect(res.status).toBe(400);
  });

  test('GET /api/ocr/:id и DELETE', async () => {
    const created = await request(app).post('/api/ocr').attach('image', PNG, 'a.png');
    const id = created.body.id;
    expect((await request(app).get(`/api/ocr/${id}`)).status).toBe(200);
    expect((await request(app).delete(`/api/ocr/${id}`)).status).toBe(204);
    expect((await request(app).get(`/api/ocr/${id}`)).status).toBe(404);
  });

  test('GET /api/ocr/abc -> 400', async () => {
    expect((await request(app).get('/api/ocr/abc')).status).toBe(400);
  });
});

describe('утилиты', () => {
  test('redact маскирует токены, пароли и строки подключения', () => {
    const out = redact({
      password: 'x',
      authorization: 'Bearer abc.def',
      note: 'url postgresql://user:pw@host/db ok',
      nested: { apiKey: '123' },
    });
    expect(out.password).toBe('[REDACTED]');
    expect(out.authorization).toBe('[REDACTED]');
    expect(out.nested.apiKey).toBe('[REDACTED]');
    expect(out.note).not.toContain('pw@host');
  });

  test('detectImageType распознаёт JPEG и отвергает мусор', () => {
    const jpg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(16)]);
    expect(detectImageType(jpg)).toBe('image/jpeg');
    expect(detectImageType(Buffer.from('hello world, not an image'))).toBeNull();
  });
});
