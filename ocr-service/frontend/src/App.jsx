import { useEffect, useState } from 'react';
import { API_URL, deleteResult, fetchHistory, recognize } from './api.js';

const LANGS = [
  { value: 'eng', label: 'English' },
  { value: 'rus', label: 'Русский' },
  { value: 'eng+rus', label: 'English + Русский' },
];

export default function App() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [lang, setLang] = useState('eng');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);

  async function loadHistory() {
    try {
      const data = await fetchHistory();
      setHistory(data.items);
    } catch {
      /* история необязательна */
    }
  }

  useEffect(() => {
    loadHistory();
  }, []);

  useEffect(() => {
    if (!file) return undefined;
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  async function onSubmit() {
    if (!file) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      setResult(await recognize(file, lang));
      loadHistory();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function onDelete(id) {
    await deleteResult(id).catch(() => {});
    if (result?.id === id) setResult(null);
    loadHistory();
  }

  function triggerTestError() {
    // Намеренная необработанная ошибка для проверки Sentry (п. 6 задания)
    throw new Error('Sentry frontend test error');
  }

  return (
    <main className="wrap">
      <h1>Распознавание текста (OCR)</h1>
      <p className="muted">Загрузите изображение (PNG, JPEG, WEBP, BMP до 5 МБ) — сервис вернёт текст.</p>

      <section className="card">
        <input type="file" accept="image/png,image/jpeg,image/webp,image/bmp" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        <select value={lang} onChange={(e) => setLang(e.target.value)}>
          {LANGS.map((l) => (
            <option key={l.value} value={l.value}>{l.label}</option>
          ))}
        </select>
        <button onClick={onSubmit} disabled={!file || loading}>{loading ? 'Распознаём…' : 'Распознать'}</button>
        {preview && <img className="preview" src={preview} alt="Предпросмотр" />}
        {error && <p className="error">{error}</p>}
        {loading && <p className="muted">Первый запрос после простоя может занять до минуты — бесплатный сервер «просыпается».</p>}
      </section>

      {result && (
        <section className="card">
          <h2>Результат</h2>
          <p className="muted">Уверенность: {result.confidence}% · время: {result.durationMs} мс</p>
          <textarea readOnly value={result.text} rows={8} />
          <button onClick={() => navigator.clipboard?.writeText(result.text)}>Копировать</button>
        </section>
      )}

      <section className="card">
        <h2>История</h2>
        {history.length === 0 && <p className="muted">Пока пусто.</p>}
        <ul className="history">
          {history.map((h) => (
            <li key={h.id}>
              <span>#{h.id} · {h.filename} · {h.language} · {(h.text || '').slice(0, 40) || '—'}</span>
              <button className="link" onClick={() => setResult(h)}>показать</button>
              <button className="link danger" onClick={() => onDelete(h.id)}>удалить</button>
            </li>
          ))}
        </ul>
      </section>

      <footer className="muted">
        <a href={`${API_URL}/dashboard`} target="_blank" rel="noreferrer">Дашборд метрик</a> ·{' '}
        <a href={`${API_URL}/health`} target="_blank" rel="noreferrer">/health</a> ·{' '}
        <button className="link" onClick={triggerTestError}>Проверка Sentry</button>
      </footer>
    </main>
  );
}
