# PWA Push Messenger

Тестовое PWA-приложение для обмена сообщениями с push-уведомлениями через self-hosted [PushHive](https://github.com/dhirendralive9/pushhive).

## Текущий статус

Реализованы **все шаги плана (1–6)**: каркас, API, PushHive в compose, push-поток, UI на owl.js, TLS-профили.

OWL подключается **локально** из [`frontend/libs/owl.iife.js`](frontend/libs/owl.iife.js) (без CDN). Отдельный план миграции на каркас [fastapi-owl](https://github.com/aayartsev/fastapi-owl) — в [`.cursor/plans/fastapi_owl_migration.plan.md`](.cursor/plans/fastapi_owl_migration.plan.md).

## Быстрый старт (dev без Docker)

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export DATABASE_PATH=../data/app.db FRONTEND_DIR=../frontend
uvicorn app.main:app --reload --port 8000
```

## Полный стек (базовый compose)

```bash
./scripts/setup-pushhive.sh
docker compose up --build -d
./scripts/seed-pushhive.sh
docker compose up -d app
```

- Приложение: http://localhost:8000  
- PushHive UI: http://localhost:3000  

`PUSHHIVE_URL` — адрес для **бэкенда** (в Docker: `http://pushhive:3000`).  
`PUSHHIVE_PUBLIC_URL` — адрес PushHive для **браузера** (отдаётся в `GET /api/config` как `pushhive_url`).

## Профили доступа (шаг 6)

### A. Localhost HTTP через Caddy (`:80`)

```bash
docker compose -f docker-compose.yml -f docker-compose.local.yml up --build -d
```

Приложение: http://localhost — PushHive API с префикса http://localhost/ph  

Secure context для Web Push на `localhost` работает без TLS.

### B. LAN с рабочим сертификатом (mkcert) — рекомендуется для телефона

```bash
./scripts/gen-mkcert.sh
# пропишите в hosts/DNS: <LAN-IP> pwa.lan push.lan
# на телефоне установите rootCA.pem из вывода скрипта

export PUBLIC_APP_URL=https://pwa.lan
export PUSHHIVE_PUBLIC_URL=https://push.lan
docker compose -f docker-compose.yml -f docker-compose.https.yml up --build -d
./scripts/seed-pushhive.sh   # если ещё не делали; domain сайта = pwa.lan
docker compose up -d app
```

Откройте https://pwa.lan на телефоне в той же сети — можно ставить PWA и принимать push.

### C. Публичный сервер (Let's Encrypt, один домен + `/ph`)

В `.env`:

```env
PUBLIC_APP_HOST=app.example.com
PUBLIC_APP_URL=https://app.example.com
PUSHHIVE_PUBLIC_URL=https://app.example.com/ph
PUSHHIVE_SITE_DOMAIN=app.example.com
```

DNS A-запись `app.example.com` → IP сервера, порты 80/443 открыты:

```bash
docker compose -f docker-compose.yml -f docker-compose.public.yml up --build -d
```

Caddy сам выпустит сертификат Let's Encrypt. Приложение на `/`, PushHive на `/ph`.

## UI

1. Регистрация имени (+ Web Push)  
2. Список пользователей + «Обновить»  
3. Текст и ✈  

Сессия в `localStorage`. Кнопка «Установить» при `beforeinstallprompt`.

## Тесты

```bash
cd backend && source .venv/bin/activate && pytest
node --test frontend/tests/*.test.mjs
```

## API

| Метод | Путь | Назначение |
|-------|------|------------|
| GET | `/api/health` | Healthcheck |
| GET | `/api/config` | Публичный конфиг (в т.ч. browser URL PushHive) |
| POST/GET | `/api/users` | Регистрация / список |
| POST/GET | `/api/messages` | Отправка (+ PushHive test) / чтение |
| POST | `/api/push/ack` | SW → статус `delivered` |
| GET | `/sw.js` | Service worker |

## Структура

| Путь | Назначение |
|------|------------|
| `backend/` | FastAPI + SQLite |
| `frontend/` | owl.js PWA |
| `frontend/libs/owl.iife.js` | Локальная копия OWL 2.4.1 (без CDN) |
| `caddy/` | Caddyfile.local / .https / .public |
| `scripts/setup-pushhive.sh` | Клон vendor + VAPID |
| `scripts/seed-pushhive.sh` | Admin + Site API key |
| `scripts/gen-mkcert.sh` | Сертификаты LAN |
| `docker-compose*.yml` | Базовый стек и профили |

## Ограничение PushHive

Для 1:1 используется `POST /api/v1/test/:subscriberId`. Webhook `notification.delivered` отсутствует — доставку подтверждаем через наш service worker (`/api/push/ack`).
