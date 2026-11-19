// Маскирование чувствительных данных в логах и событиях Sentry.
const SENSITIVE_KEY = /pass(word)?|token|secret|authorization|cookie|api[-_]?key|dsn|connection|database_url/i;

function redactString(s) {
  return s
    .replace(/postgres(ql)?:\/\/[^\s"']+/gi, 'postgres://[REDACTED]')
    .replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/g, 'Bearer [REDACTED]')
    .replace(/bot\d{6,}:[A-Za-z0-9_-]{20,}/g, 'bot[REDACTED]');
}

function redact(value, depth = 0) {
  if (value === null || value === undefined || depth > 6) return value;
  if (typeof value === 'string') return redactString(value);
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  if (value instanceof Error) {
    return { name: value.name, message: redactString(value.message), stack: value.stack && redactString(value.stack) };
  }
  if (typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = SENSITIVE_KEY.test(k) ? '[REDACTED]' : redact(v, depth + 1);
    }
    return out;
  }
  return value;
}

module.exports = { redact, redactString };
