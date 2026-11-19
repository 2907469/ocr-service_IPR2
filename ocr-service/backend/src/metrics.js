const os = require('os');

const startedAt = Date.now();
const state = {
  requestsTotal: 0,
  byStatus: { '2xx': 0, '3xx': 0, '4xx': 0, '5xx': 0 },
  ocrTotal: 0,
  ocrFailed: 0,
  ocrDurationSum: 0,
};

function middleware(req, res, next) {
  state.requestsTotal += 1;
  res.on('finish', () => {
    const key = `${Math.floor(res.statusCode / 100)}xx`;
    state.byStatus[key] = (state.byStatus[key] || 0) + 1;
  });
  next();
}

function recordOcr(durationMs, ok) {
  state.ocrTotal += 1;
  if (ok) state.ocrDurationSum += durationMs;
  else state.ocrFailed += 1;
}

const mb = (bytes) => Math.round((bytes / 1024 / 1024) * 10) / 10;

function snapshot() {
  const mem = process.memoryUsage();
  const okCount = state.ocrTotal - state.ocrFailed;
  const cpu = process.cpuUsage();
  return {
    status: 'ok',
    node: process.version,
    startedAt: new Date(startedAt).toISOString(),
    uptimeSeconds: Math.round(process.uptime()),
    memory: {
      rssMb: mb(mem.rss),
      heapUsedMb: mb(mem.heapUsed),
      heapTotalMb: mb(mem.heapTotal),
      systemTotalMb: mb(os.totalmem()),
      systemFreeMb: mb(os.freemem()),
    },
    cpu: {
      cores: os.cpus().length,
      loadAvg: os.loadavg().map((n) => Math.round(n * 100) / 100),
      processUserMs: Math.round(cpu.user / 1000),
      processSystemMs: Math.round(cpu.system / 1000),
    },
    requests: { total: state.requestsTotal, ...state.byStatus },
    ocr: {
      total: state.ocrTotal,
      failed: state.ocrFailed,
      avgDurationMs: okCount > 0 ? Math.round(state.ocrDurationSum / okCount) : 0,
    },
  };
}

module.exports = { middleware, recordOcr, snapshot };
