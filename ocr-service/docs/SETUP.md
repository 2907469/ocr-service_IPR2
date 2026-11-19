# Пошаговая настройка (≈ 1–1,5 часа)

Порядок важен: сначала БД и бэкенд, потом фронтенд, потом мониторинг.
Все сервисы из списка работают из Беларуси по условию задания; если регистрация не проходит — выбирай альтернативу из раздела 3 задания и опиши это в отчёте.

## 0. Репозиторий
```bash
cd ocr-service
git init
git add . && git commit -m "OCR service for IPR2"
git branch -M main
git remote add origin https://github.com/ВАШ_ЛОГИН/ВАШ_РЕПО.git
git push -u origin main
git checkout -b ipr22
```
Перед первым push **один раз** выполни `npm install` в `backend/` и `frontend/` и закоммить созданные `package-lock.json` — без них `npm ci` в GitHub Actions упадёт.
Если у тебя уже есть репозиторий курсовой — скопируй в него `.github/`, `render.yaml`, `docs/`, а из бэкенда — `src/logger.js`, `src/instrument.js`, `src/metrics.js`, `src/telegram.js`, `public/` и подключи по аналогии с `src/app.js`.

## 1. Neon (PostgreSQL)
1. neon.tech → Sign up → Create project (регион Frankfurt).
2. Скопируй **Connection string** вида `postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require` — это `DATABASE_URL`.
Таблица создаётся автоматически при старте бэкенда.

## 2. Telegram-бот
1. @BotFather → `/newbot` → получи токен (`TELEGRAM_BOT_TOKEN`).
2. Напиши своему боту любое сообщение (или добавь его в чат).
3. @userinfobot → узнай свой id (`TELEGRAM_CHAT_ID`). Для группы — id отрицательный.

## 3. Sentry
1. sentry.io → создай два проекта: **Node.js** (backend) и **React** (frontend).
2. Скопируй DSN каждого (`SENTRY_DSN` для бэкенда, `VITE_SENTRY_DSN` для фронтенда).
3. (Для source maps) Settings → Auth Tokens → создай токен; запомни slug организации и проекта фронтенда.

## 4. Better Stack Logs (Logtail)
1. betterstack.com → Telemetry → Sources → Connect source → тип **Node.js**.
2. Скопируй **Source token** (`LOGTAIL_SOURCE_TOKEN`) и **Ingesting host** (`LOGTAIL_ENDPOINT`, в виде `https://sXXXX.betterstackdata.com`). Если у твоего источника хоста нет — оставь `LOGTAIL_ENDPOINT` пустым.
Альтернатива по заданию: Papertrail или winston + Telegram.

## 5. Render (бэкенд)
1. render.com → New → Web Service → подключи GitHub-репозиторий.
2. Root Directory: `backend`; Build: `npm ci`; Start: `npm start`; Instance type: **Free**; Health Check Path: `/health`; **Auto-Deploy: No** (деплоит GitHub Actions).
3. Branch: `ipr22` (на время сдачи) или `main`.
4. Environment: `NODE_ENV=production`, `NODE_VERSION=20`, `DATABASE_URL`, `CORS_ORIGIN` (URL Vercel, заполнишь позже), `SENTRY_DSN`, `LOGTAIL_SOURCE_TOKEN`, `LOGTAIL_ENDPOINT`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `ADMIN_TOKEN` (случайная строка), опционально `NOTIFY_ON_START=true`.
5. Запиши URL (`https://xxx.onrender.com`) → проверь `/health`.
6. Для GitHub Secrets: `RENDER_SERVICE_ID` — из URL сервиса (`srv-...`), `RENDER_API_KEY` — Account Settings → API Keys.

Ограничение free-плана: сервис засыпает через 15 минут без запросов, пробуждение ≈ минута. Это нужно упомянуть в вопросе 13 отчёта.

## 6. Vercel (фронтенд)
1. vercel.com → Add New Project → тот же репозиторий, Root Directory: `frontend`, Framework: Vite.
2. Environment Variables: `VITE_API_URL=https://xxx.onrender.com`, `VITE_SENTRY_DSN`, и для source maps: `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`.
3. Settings → Git → отключи автодеплой из Git (или оставь — тогда будет два деплоя; для лабы лучше отключить, чтобы деплоил только workflow).
4. Для GitHub Secrets: `VERCEL_ORG_ID` и `VERCEL_PROJECT_ID` — Project Settings → General; `VERCEL_TOKEN` — Account Settings → Tokens.
5. Вернись в Render и допиши `CORS_ORIGIN=https://ВАШ.vercel.app`.

## 7. GitHub Secrets
Repo → Settings → Secrets and variables → Actions → New repository secret:
`RENDER_API_KEY`, `RENDER_SERVICE_ID`, `BACKEND_URL` (без `/` в конце), `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`.

## 8. Запуск пайплайна
```bash
git checkout ipr22
git push -u origin ipr22
```
Actions → смотри run. В Telegram придёт сообщение «✅ Сборка и деплой прошли успешно». Сделай скриншот.
Для проверки провала: в тесте поменяй ожидаемое значение, запушь, получи «❌», потом верни обратно.

## 9. UptimeRobot
1. uptimerobot.com → Add New Monitor → HTTP(s) → URL `https://xxx.onrender.com/health`, интервал 5 минут.
2. Второй монитор — главная страница Vercel.
3. Integrations → Telegram (подключение через бота UptimeRobot) или Webhook на твой бот → уведомления о падении.
4. (Необязательно) Status Pages → создай публичную страницу и вставь ссылку в README.
Для проверки «падения»: в Render нажми Suspend на сервисе → через 5–10 минут придёт «Down» в Telegram → Resume.

## 10. Проверка Sentry
- Бэкенд: `curl -H "X-Admin-Token: ВАШ_ADMIN_TOKEN" https://xxx.onrender.com/debug-sentry` → ошибка появится в проекте Node.js.
- Фронтенд: на сайте внизу «Проверка Sentry» → ошибка в проекте React (со стеком в исходниках, если загрузились source maps).

## 11. Скриншоты для отчёта (чек-лист)
1. `deploy.yml` в репозитории (GitHub, вкладка файла)
2. Успешный run в Actions (все шаги зелёные)
3. Render — страница сервиса/деплоя (Live)
4. Vercel — Production deployment
5. Neon — таблица `ocr_results` (необязательно)
6. UptimeRobot — дашборд мониторов (Up)
7. Better Stack Logs — поток логов (`server_started`, `ocr_completed`, `http_request`)
8. Sentry — Issues с тестовой ошибкой (бэкенд и фронтенд)
9. `/dashboard` и `/metrics` в браузере
10. Telegram — сообщение о сборке и сообщение о падении сервера
11. Работающее приложение: загрузка картинки и результат
