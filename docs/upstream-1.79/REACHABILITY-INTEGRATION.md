# BSCHEKER: включение проверенной интеграции

2026-09-30. Контракт бота: `hebu001/remnawave-bedolaga-telegram-bot`,
ветка `codex/bot-upstream-v4.15.0`, SHA `70c8835b65dd7b82ff023c78b20ccb0524ebeee6`.

## Причина и исправление

При адаптации 1.79.0 `reachability` оставили среди ожидающих проверки контрактов.
Флаг сборки блокировал меню, маршруты и запрос статуса, поэтому серверный
`BSCHEK_ENABLED=true` не открывал раздел. После проверки контракт включён.
Серверные `enabled/configured` по-прежнему управляют доступностью проверок и
инструкцией настройки. Маршруты и меню требуют `reachability:read`;
создание заданий на сервере требует `reachability:run`.

## Доказательства совместимости

- Сверены `src/api/reachability.ts` и схемы/маршруты
  `app/cabinet/{schemas/reachability.py,routes/admin_reachability.py}` указанного бота.
- Через production `https://evoevo.app/api/cabinet/admin/reachability` проверены GET
  `status`, `units`, `targets/hosts`, `targets/nodes`, `jobs`, `batches`, `summary/hosts`:
  HTTP 200, ответы проходят Pydantic-схемы бота. Статус: enabled/configured/healthy = true.
  Анонимный запрос статуса получает 401, обычный пользователь — 403.
- `src/test/fixtures/reachabilityBotContract.ts` — синтетическая проекция StatusResponse,
  без данных production. Тесты используют реальный флаг сборки, без подмены его на true.
- 345 тестов в 81 файле: компоненты BSCHEKER, GEO API, меню админки, маршруты,
  права чтения, отключённый и ненастроенный сервис. TypeScript — PASS.

Платные задания в production при проверке не запускались. Проверка операций запуска
в этой поставке синтетическая. Подробности развёртывания, бэкапа и отката:
локальный отчёт `work/prod-cabinet-bscheker-20260930/RESULT.md`.
