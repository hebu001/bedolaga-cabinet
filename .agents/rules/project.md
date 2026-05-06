---
description: Правила работы с проектом bedolaga-cabinet для AI агентов
---

# Bedolaga Cabinet — Rules for AI Agents

Эти правила являются копией из `.claude/rules/`. При расхождении — `.claude/rules/` является источником правды.

## Быстрые ссылки

- Полная архитектура → `.claude/rules/architecture.md`
- Auth flow → `.claude/rules/auth.md`
- API contracts → `.claude/rules/api.md`
- DevOps → `.claude/rules/devops.md`
- Security → `.claude/rules/security.md`
- Frontend → `.claude/rules/frontend.md`
- Working rules → `.claude/rules/working-rules.md`
- Backend context → `.claude/rules/backend.md`

## Протокол задачи (обязательно)

1. Прочитай `CLAUDE.md`
2. Прочитай релевантные `.claude/rules/*.md`
3. Прочитай релевантные `docs/project/*.md`
4. Только потом выполняй задачу
5. После значимых изменений обнови docs

## Критические правила

- **Не фантазируй** о backend (код недоступен)
- **Помечай**: `[confirmed]`, `[assumption]`, `[unknown]`
- **VITE_* env** требуют пересборки Docker образа при изменении
- **npm НЕ установлен** на production сервере — сборка через Docker
- **App.tsx** — GOD file 1173 строки — изменять осторожно

## Сборка и деплой

```bash
docker build --no-cache -t cabinet_frontend_build /opt/bedolaga-cabinet
rm -rf /opt/bedolaga-cabinet/dist
docker create --name tmp_cabinet cabinet_frontend_build
docker cp tmp_cabinet:/usr/share/nginx/html /opt/bedolaga-cabinet/dist
docker rm tmp_cabinet
docker exec remnawave_caddy caddy reload --config /etc/caddy/Caddyfile
```
