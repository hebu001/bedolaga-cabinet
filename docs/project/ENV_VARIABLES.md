# ENV VARIABLES — Bedolaga Cabinet

## Build-time переменные (вшиваются в JS при сборке)

> [!IMPORTANT]
> Изменение любой VITE_* переменной требует полной пересборки Docker образа!

| Переменная | Текущее значение | Описание | Обязательна |
|---|---|---|---|
| `VITE_API_URL` | `/api` | Base URL для API запросов | ✅ |
| `VITE_TELEGRAM_BOT_USERNAME` | `evo_bedol_bot` | Username бота (без @) | ✅ |
| `VITE_APP_NAME` | `EvoVPN` | Название в шапке и вкладке | ✅ |
| `VITE_APP_LOGO` | `BE` | Текст логотипа (1-2 символа) | ✅ |

Файл: `/opt/bedolaga-cabinet/.env`

## Runtime переменные (Docker, если используется cabinet_frontend контейнер)

| Переменная | Default | Описание |
|---|---|---|
| `CABINET_PORT` | `3020` | Порт хоста для cabinet (если запускать контейнером) |

> **Текущий production** не использует cabinet_frontend контейнер — Caddy раздаёт статику напрямую.

## Backend .env (в боте, не в этом репозитории)

| Переменная | Необходима | Описание |
|---|---|---|
| `CABINET_ENABLED` | ✅ | Включить Cabinet API (false по умолчанию) |
| `CABINET_JWT_SECRET` | ✅ | JWT секрет |
| `CABINET_ALLOWED_ORIGINS` | ✅ | CORS origins (через запятую) |
| `CABINET_ACCESS_TOKEN_EXPIRE_MINUTES` | — | Default: 15 |
| `CABINET_REFRESH_TOKEN_EXPIRE_DAYS` | — | Default: 7 |

Текущее значение CABINET_ALLOWED_ORIGINS должно содержать: `https://miniapp.evovpn.ru`

## Как изменить env и задеплоить

```bash
# 1. Изменить /opt/bedolaga-cabinet/.env
nano /opt/bedolaga-cabinet/.env

# 2. Пересобрать (ОБЯЗАТЕЛЬНО при изменении VITE_*)
docker build --no-cache -t cabinet_frontend_build /opt/bedolaga-cabinet

# 3. Обновить dist
rm -rf /opt/bedolaga-cabinet/dist
docker create --name tmp_cabinet cabinet_frontend_build
docker cp tmp_cabinet:/usr/share/nginx/html /opt/bedolaga-cabinet/dist
docker rm tmp_cabinet

# 4. Перезагрузить Caddy
docker exec remnawave_caddy caddy reload --config /etc/caddy/Caddyfile
```
