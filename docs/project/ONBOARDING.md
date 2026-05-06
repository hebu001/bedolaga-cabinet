# ONBOARDING — Bedolaga Cabinet

## Что читать в первую очередь

1. `CLAUDE.md` — обзор проекта и правила работы
2. `docs/project/PROJECT_OVERVIEW.md` — что это и зачем
3. `docs/project/ARCHITECTURE.md` — как устроено
4. `docs/project/AUTH_AND_ROLES.md` — auth flow и RBAC
5. `docs/project/DEVOPS.md` — как запустить и задеплоить

## Как запустить локально

> [!IMPORTANT]
> npm НЕ установлен на production сервере. На локальной машине разработчика он нужен.

```bash
git clone https://github.com/hebu001/bedolaga-cabinet
cd bedolaga-cabinet
cp .env.example .env
# Отредактировать .env:
# VITE_API_URL=http://localhost:8080   (или адрес бота)
# VITE_TELEGRAM_BOT_USERNAME=your_bot
npm install
npm run dev
# → http://localhost:5173
# Dev-server проксирует /api → localhost:8080
```

> [!NOTE]
> Для полноценной работы нужен запущенный backend бот (`remnawave-bedolaga-telegram-bot`) с включённым Cabinet API.

## Как обновить production

```bash
cd /opt/bedolaga-cabinet
git pull origin main
docker build --no-cache -t cabinet_frontend_build .
rm -rf dist
docker create --name tmp_cabinet cabinet_frontend_build
docker cp tmp_cabinet:/usr/share/nginx/html dist
docker rm tmp_cabinet
docker exec remnawave_caddy caddy reload --config /etc/caddy/Caddyfile
```

## Ключевые точки входа

| Точка входа | Файл | Описание |
|---|---|---|
| App bootstrap | `src/main.tsx` | Telegram SDK, QueryClient, render |
| Providers + Router | `src/AppWithNavigator.tsx` | Все провайдеры + BrowserRouter |
| Весь роутер | `src/App.tsx` | ВСЕ маршруты (1173 строки!) |
| Auth state | `src/store/auth.ts` | Zustand store, инициализируется при импорте |
| API client | `src/api/client.ts` | Axios, interceptors, CSRF |
| Все типы | `src/types/index.ts` | Центральный файл типов |

## Как найти нужный route/feature

```
Маршрут → App.tsx → найди Route path="..."
Страница → src/pages/PageName.tsx
API вызовы на странице → посмотри импорты из src/api/
Типы данных → src/types/index.ts
```

## Где чаще всего ломают проект

1. **App.tsx** — синтаксическая ошибка = белый экран у всех
2. **src/api/client.ts** — изменение interceptors = все запросы сломаны
3. **Caddyfile** — ошибка синтаксиса (особенно `{` без пробела) = Caddy не стартует
4. **VITE_* env** — изменение без пересборки = старые значения в браузере
5. **docker build без --no-cache** — используется кэшированный layer со старым кодом

## Checklist для нового разработчика

- [ ] Прочитал CLAUDE.md
- [ ] Прочитал docs/project/PROJECT_OVERVIEW.md
- [ ] Прочитал docs/project/ARCHITECTURE.md
- [ ] Понял auth flow (docs/project/AUTH_AND_ROLES.md)
- [ ] Понял deploy flow (docs/project/DEVOPS.md)
- [ ] Попробовал `npm run dev` локально
- [ ] Разобрался со структурой src/
- [ ] Нашёл нужный маршрут (docs/project/ROUTES_AND_SCREENS.md)
- [ ] Понял как добавить новую страницу (см. .claude/rules/frontend.md)
- [ ] Понял как добавить новый API endpoint (см. .claude/rules/api.md)
