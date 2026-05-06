# DEVOPS — Bedolaga Cabinet

## Production архитектура

```
Internet
    ↓ :80/:443
Caddy (remnawave_caddy) — miniapp.evovpn.ru
    /api/* → https://bed.evovpn.ru  (external backend)
    /*     → /srv/cabinet = /opt/bedolaga-cabinet/dist (read-only mount)
```

## Конфигурационные файлы

| Файл | Назначение |
|---|---|
| `/opt/caddy/Caddyfile` | Caddy конфиг |
| `/opt/caddy/docker-compose.yml` | Caddy Docker Compose |
| `/opt/bedolaga-cabinet/.env` | Build-time env |
| `/opt/bedolaga-cabinet/docker-compose.yml` | (dev/build, не для prod) |
| `/opt/bedolaga-cabinet/docker-compose.prod.yml` | (создан, не используется) |
| `/opt/bedolaga-cabinet/Dockerfile` | Multi-stage build |
| `/opt/bedolaga-cabinet/nginx.conf` | Nginx внутри Docker (не в prod) |

## Процесс сборки (confirmed — Docker multi-stage)

```dockerfile
# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci                          # или npm install
COPY . .
ARG VITE_API_URL VITE_TELEGRAM_BOT_USERNAME VITE_APP_NAME VITE_APP_LOGO
ENV VITE_API_URL=$VITE_API_URL ...
RUN npm run build                   # → /app/dist

# Stage 2: Serve (в docker-compose варианте)
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

## Команды управления

```bash
# Статус Caddy
docker ps | grep caddy
docker logs remnawave_caddy --tail 50

# Проверка конфига Caddy
docker exec remnawave_caddy caddy validate --config /etc/caddy/Caddyfile

# Перезагрузка Caddy (без даунтайма)
docker exec remnawave_caddy caddy reload --config /etc/caddy/Caddyfile

# Перезапуск Caddy (с даунтаймом ~1с)
cd /opt/caddy && docker compose up -d --force-recreate

# Проверка dist файлов
ls -la /opt/bedolaga-cabinet/dist/

# Проверка что сайт отвечает
curl -I https://miniapp.evovpn.ru/
```

## Процесс обновления

```bash
cd /opt/bedolaga-cabinet

# 1. Получить обновления
git pull origin main

# 2. Пересобрать (--no-cache обязателен при изменении зависимостей)
docker build --no-cache -t cabinet_frontend_build .

# 3. Вытащить dist
rm -rf dist
docker create --name tmp_cabinet cabinet_frontend_build
docker cp tmp_cabinet:/usr/share/nginx/html dist
docker rm tmp_cabinet

# 4. Применить (Caddy подхватит файлы автоматически, reload для конфига)
docker exec remnawave_caddy caddy reload --config /etc/caddy/Caddyfile
```

## Volumes и Mounts

```yaml
# /opt/caddy/docker-compose.yml
volumes:
  - ./Caddyfile:/etc/caddy/Caddyfile      # конфиг
  - caddy_data:/data                       # сертификаты Let's Encrypt
  - caddy_config:/config                   # Caddy config cache
  - /opt/bedolaga-cabinet/dist:/srv/cabinet:ro  # статика (read-only)
```

## Networks
- `caddy_network` — Docker network для Caddy
- Backend `bed.evovpn.ru` — внешний, не в Docker сети

## Health Check

Caddy:
```bash
docker inspect remnawave_caddy --format='{{.State.Status}}'
curl -I http://miniapp.evovpn.ru/  # ожидаем 308 redirect
curl -I https://miniapp.evovpn.ru/  # ожидаем 200
```

## Локальная разработка

```bash
# Нужен npm на хосте и запущенный backend на :8080
cd /opt/bedolaga-cabinet
npm install
cp .env.example .env
# Задать VITE_API_URL=http://localhost:8080
npm run dev  # → http://localhost:5173
```
