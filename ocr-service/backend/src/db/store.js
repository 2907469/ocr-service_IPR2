// Хранилище результатов OCR: PostgreSQL (Neon) или in-memory (локальный запуск/тесты).
const config = require('../config');

function createMemoryStore() {
  let seq = 1;
  const rows = [];
  return {
    kind: 'memory',
    async init() {},
    async ping() { return true; },
    async close() {},
    async save(r) {
      const row = { id: seq++, createdAt: new Date().toISOString(), ...r };
      rows.unshift(row);
      return row;
    },
    async list(limit = 20, offset = 0) { return rows.slice(offset, offset + limit); },
    async get(id) { return rows.find((r) => r.id === id) || null; },
    async remove(id) {
      const i = rows.findIndex((r) => r.id === id);
      if (i < 0) return false;
      rows.splice(i, 1);
      return true;
    },
    async count() { return rows.length; },
  };
}

const COLUMNS = 'id, filename, mime_type, size_bytes, language, text, confidence, duration_ms, created_at';

function mapRow(r) {
  return {
    id: r.id,
    filename: r.filename,
    mimeType: r.mime_type,
    sizeBytes: r.size_bytes,
    language: r.language,
    text: r.text,
    confidence: r.confidence,
    durationMs: r.duration_ms,
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at,
  };
}

function createPgStore(url) {
  const { Pool } = require('pg');
  const pool = new Pool({
    connectionString: url,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });
  return {
    kind: 'postgres',
    async init() {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS ocr_results (
          id SERIAL PRIMARY KEY,
          filename TEXT NOT NULL,
          mime_type TEXT NOT NULL,
          size_bytes INTEGER NOT NULL,
          language TEXT NOT NULL,
          text TEXT NOT NULL,
          confidence REAL,
          duration_ms INTEGER NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )`);
    },
    async ping() { await pool.query('SELECT 1'); return true; },
    async close() { await pool.end(); },
    async save(r) {
      const { rows } = await pool.query(
        `INSERT INTO ocr_results (filename, mime_type, size_bytes, language, text, confidence, duration_ms)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING ${COLUMNS}`,
        [r.filename, r.mimeType, r.sizeBytes, r.language, r.text, r.confidence, r.durationMs]
      );
      return mapRow(rows[0]);
    },
    async list(limit = 20, offset = 0) {
      const { rows } = await pool.query(
        `SELECT ${COLUMNS} FROM ocr_results ORDER BY id DESC LIMIT $1 OFFSET $2`,
        [limit, offset]
      );
      return rows.map(mapRow);
    },
    async get(id) {
      const { rows } = await pool.query(`SELECT ${COLUMNS} FROM ocr_results WHERE id = $1`, [id]);
      return rows[0] ? mapRow(rows[0]) : null;
    },
    async remove(id) {
      const res = await pool.query('DELETE FROM ocr_results WHERE id = $1', [id]);
      return res.rowCount > 0;
    },
    async count() {
      const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM ocr_results');
      return rows[0].n;
    },
  };
}

function createStore() {
  return config.databaseUrl ? createPgStore(config.databaseUrl) : createMemoryStore();
}

module.exports = { createStore, createMemoryStore, createPgStore };
