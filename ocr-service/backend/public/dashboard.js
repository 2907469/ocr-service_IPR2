(function () {
  function $(id) { return document.getElementById(id); }
  function fmtUptime(s) {
    var d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
    return (d ? d + 'д ' : '') + h + 'ч ' + m + 'м ' + (s % 60) + 'с';
  }
  async function refresh() {
    try {
      var h = await fetch('/health').then(function (r) { return r.json(); });
      var m = await fetch('/metrics').then(function (r) { return r.json(); });
      $('status').textContent = h.status === 'ok' ? 'OK' : 'DEGRADED';
      $('status').className = 'val ' + (h.status === 'ok' ? 'ok' : 'bad');
      $('db').textContent = 'БД: ' + h.db + ' (' + h.store + ')';
      $('uptime').textContent = fmtUptime(m.uptimeSeconds);
      $('started').textContent = 'с ' + m.startedAt;
      $('rss').textContent = m.memory.rssMb + ' МБ';
      $('heap').textContent = 'heap: ' + m.memory.heapUsedMb + ' / ' + m.memory.heapTotalMb + ' МБ';
      var used = m.memory.systemTotalMb - m.memory.systemFreeMb;
      $('sysmem').textContent = Math.round(used) + ' / ' + Math.round(m.memory.systemTotalMb) + ' МБ';
      $('sysbar').style.width = Math.min(100, (used / m.memory.systemTotalMb) * 100) + '%';
      $('load').textContent = m.cpu.loadAvg.join(' / ');
      $('cores').textContent = 'ядер: ' + m.cpu.cores + ' · 1/5/15 мин';
      $('req').textContent = m.requests.total;
      $('codes').textContent = '2xx: ' + m.requests['2xx'] + ' · 4xx: ' + m.requests['4xx'] + ' · 5xx: ' + m.requests['5xx'];
      $('ocr').textContent = m.ocr.total;
      $('ocrd').textContent = 'ошибок: ' + m.ocr.failed + ' · среднее время: ' + m.ocr.avgDurationMs + ' мс';
      $('stored').textContent = m.storedResults === null ? 'н/д' : m.storedResults;
      $('node').textContent = 'Node ' + m.node;
      $('updated').textContent = new Date().toLocaleTimeString();
    } catch (e) {
      $('status').textContent = 'НЕДОСТУПЕН';
      $('status').className = 'val bad';
    }
  }
  refresh();
  setInterval(refresh, 5000);
})();
