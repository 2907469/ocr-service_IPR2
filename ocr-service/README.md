# OCR Service — распознавание текста с изображений

ИПР №2 «Деплой и мониторинг приложения», вариант 5. Веб-сервис: загружаешь изображение — получаешь текст (Tesseract OCR, языки English / Русский), история распознаваний хранится в PostgreSQL.

## Ссылки (заполнить после деплоя)

| Что | URL |
|---|---|
| Frontend (Vercel) | https://ВАШ-ПРОЕКТ.vercel.app |
| Backend API (Render) | https://ВАШ-СЕРВИС.onrender.com |
| Health / Metrics / Dashboard | `/health` · `/metrics` · `/dashboard` на URL бэкенда |
| UptimeRobot (дашборд) | https://stats.uptimerobot.com/ВАШ-ID  (или ссылка на страницу мониторов) |
| Sentry (ошибки) | https://sentry.io/organizations/ВАША-ОРГ/projects/ |
| Better Stack Logs | https://telemetry.betterstack.com/ |
| Telegram-бот для уведомлений | @ИМЯ_БОТА (чат: ссылка/название) |

## Стек

- **Backend:** Node.js 20, Express, tesseract.js, PostgreSQL (`pg`), multer, helmet, winston
- **Frontend:** React 18 + Vite
- **CI/CD:** GitHub Actions → Render (backend), Vercel (frontend)
- **БД:** Neon (PostgreSQL, free tier)
- **Мониторинг:** UptimeRobot, `/health`, `/metrics`, `/dashboard`
- **Логи:** Better Stack Logs (Logtail) через winston
- **Ошибки:** Sentry (`@sentry/node`, `@sentry/react`, source maps)
- **Уведомления:** Telegram Bot API

## Структура

```
backend/   Express API, OCR, метрики, логирование, Sentry, тесты (Jest)
frontend/  React-интерфейс (загрузка, результат, история)
.github/workflows/deploy.yml   CI/CD
render.yaml                    blueprint для Render (необязательно)
docs/SETUP.md                  пошаговая настройка облачных сервисов
```

## Запуск локально

Нужен Node.js 20+.

```bash
# 1) бэкенд
cd backend
cp .env.example .env        # Windows: copy .env.example .env
npm install
npm test                    # тесты
npm run dev                 # http://localhost:3000  (без DATABASE_URL данные хранятся в памяти)

# 2) фронтенд (в другом терминале)
cd frontend
cp .env.example .env
npm install
npm run dev                 # http://localhost:5173
```

Проверка: открыть http://localhost:5173, загрузить картинку с текстом. Первый запрос скачивает языковые данные Tesseract (нужен интернет), потом быстрее.
Метрики: http://localhost:3000/dashboard

## API

| Метод | URL | Описание |
|---|---|---|
| POST | `/api/ocr` | multipart: `image` (файл), `lang` (`eng`, `rus`, `eng+rus`, `bel`) → 201 + результат |
| GET | `/api/ocr?limit&offset` | история |
| GET | `/api/ocr/:id` | один результат |
| DELETE | `/api/ocr/:id` | удалить |
| GET | `/health` | 200 если сервис и БД живы, иначе 503 |
| GET | `/metrics` | JSON: uptime, память, CPU load, счётчики запросов и OCR |
| GET | `/dashboard` | веб-страница с метриками |
| GET | `/debug-sentry` | тестовая ошибка (нужен заголовок `X-Admin-Token`) |

Пример: `curl -F image=@scan.png -F lang=eng http://localhost:3000/api/ocr`

## Переменные окружения

См. `backend/.env.example` и `frontend/.env.example`. Секреты хранятся только в Render / Vercel / GitHub Secrets, в репозиторий `.env` не попадает.

GitHub Secrets для пайплайна: `RENDER_API_KEY`, `RENDER_SERVICE_ID`, `BACKEND_URL`, `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`.

## Деплой

Подробная инструкция: [docs/SETUP.md](docs/SETUP.md). После настройки любой push в `main` (или `ipr22`) запускает: lint → тесты → сборка → деплой бэкенда и фронтенда → уведомление в Telegram.
