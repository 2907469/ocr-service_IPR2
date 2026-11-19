// Обёртка над tesseract.js. Держим один worker (экономим память на бесплатном тарифе)
// и выполняем распознавания строго по очереди.
const { createWorker } = require('tesseract.js');
const config = require('../config');

let current = null; // { lang, worker }
let chain = Promise.resolve();

async function ensureWorker(lang) {
  if (current && current.lang !== lang) {
    const old = current;
    current = null;
    await old.worker.terminate().catch(() => {});
  }
  if (!current) {
    const worker = await createWorker(lang, 1, { cachePath: config.ocrCachePath });
    current = { lang, worker };
  }
  return current.worker;
}

function recognize(buffer, lang = 'eng') {
  const job = chain.then(async () => {
    const worker = await ensureWorker(lang);
    const { data } = await worker.recognize(buffer);
    return { text: (data.text || '').trim(), confidence: Math.round((data.confidence || 0) * 10) / 10 };
  });
  chain = job.catch(() => {});
  return job;
}

async function shutdown() {
  if (current) {
    const old = current;
    current = null;
    await old.worker.terminate().catch(() => {});
  }
}

module.exports = { recognize, shutdown };
