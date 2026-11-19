const BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/$/, '');

export const API_URL = BASE;

async function parse(res) {
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message || `Ошибка ${res.status}`);
  return data;
}

export async function recognize(file, lang) {
  const form = new FormData();
  form.append('image', file);
  form.append('lang', lang);
  return parse(await fetch(`${BASE}/api/ocr`, { method: 'POST', body: form }));
}

export async function fetchHistory() {
  return parse(await fetch(`${BASE}/api/ocr?limit=10`));
}

export async function deleteResult(id) {
  return parse(await fetch(`${BASE}/api/ocr/${id}`, { method: 'DELETE' }));
}
