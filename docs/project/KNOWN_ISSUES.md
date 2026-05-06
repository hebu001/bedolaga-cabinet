# KNOWN ISSUES — Bedolaga Cabinet

## Активные проблемы

### ISSUE-001: nginx.conf /api/ неправильная конфигурация
- **Статус**: Open
- **Серьёзность**: LOW (не влияет на текущий production)
- **Описание**: В `nginx.conf` блок `/api/` использует `try_files` вместо `proxy_pass` — это означает что при запуске через cabinet_frontend контейнер, API запросы не проксируются
- **Файл**: `nginx.conf:14-21`
- **Когда проявляется**: Только если использовать cabinet_frontend Docker контейнер (сейчас в production не используется)

### ISSUE-002: Нет CI/CD
- **Статус**: Open
- **Серьёзность**: LOW
- **Описание**: Обновление вручную через git pull + docker build
- **Риск**: Human error при обновлении

### ISSUE-003: docker-compose.prod.yml не соответствует действительности
- **Статус**: Open
- **Серьёзность**: LOW
- **Описание**: Файл создан для вспомогательного Cabinet контейнера, но в production архитектура другая (Caddy раздаёт статику напрямую)

## Предыдущие решённые проблемы

### FIXED-001: Caddyfile синтаксическая ошибка (2026-03-16)
- `reverse_proxy https://bed.evovpn.ru{` → `reverse_proxy https://bed.evovpn.ru {`
- Caddy не стартовал с exit code 1

### FIXED-002: Caddy контейнер использовал старый конфиг (2026-03-16)
- Контейнер не был пересоздан при изменении docker-compose.yml
- Решение: `docker compose up -d --force-recreate`
