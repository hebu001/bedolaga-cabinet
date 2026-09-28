# Кабинет 1.79.0: состояние переноса

Дата: 2026-09-28. Подготовлен независимый frontend-кандидат с сохранением кастома EvoVPN. Конфликты исходников разрешены; независимая frontend-проверка пройдена. Результаты подготовлены для интеграции с ботом. Совместимость с новым ботом и тестовый релиз ожидают его готовности.

Пользователь поручил выполнить всё возможное без бота, который мержится в соседней задаче. Здесь изменяются только локальные исходники, проверки и документы кабинета. Тестовые серверы, установленный кабинет, бот, панель и прод в этой работе не изменялись.

## Источники и Git

| Назначение | Значение |
| --- | --- |
| Рабочая ветка | `codex/cabinet-upstream-v1.79.0` |
| Установленный fork / исходная база | `55a4038f4ae8692922abc2622f97309840f71064`, версия 1.57.1 |
| Включаемый upstream | tag `v1.79.0`, `f5ea595f8f732c37f2d5c270f34879ab2e2fba2d` |
| Общий предок | `206926a3a315d8c2f6f2c56052f6d147b00dd734` (1.51.0) |
| HEAD до итогового merge | `b1a44d3769fa90f73c86c08db09bed843884f237` — коммит трёх подготовительных документов поверх fork; это не установленная версия |
| Текущий тестовый бот | 3.66.0, `4b06edcdce26850c03ca474e8d195ef94ddb347e` |
| Целевой бот | SHA и схемы ещё не переданы |
| Панель | Remnawave **2.8.1** закреплена и не меняется |

Checkout создан отдельно в `work/cabinet-upstream-v1.79.0-20260928` из полного локального репозитория через clone без hardlinks. Старые dirty checkout не использованы. Origin — `hebu001/bedolaga-cabinet`, upstream — `BEDOLAGA-DEV/bedolaga-cabinet`.

Этап оформляется обычным merge с двумя родителями: подготовленный fork HEAD `b1a44d3769fa90f73c86c08db09bed843884f237` и upstream `f5ea595f8f732c37f2d5c270f34879ab2e2fba2d`. Итоговый commit следует смотреть через `git show` на этой ветке и в итоговой выдаче задачи; данные дерева на момент проверки сохранены в [VERIFICATION](VERIFICATION.md). Слияние исходников не означает публикацию или установку версии 1.79.0.

## Выполнено независимо от бота

| Область | Результат | Свидетельства |
| --- | --- | --- |
| Session / auth / WS | Сохранены generation boundary, серверные часы, ротация refresh, приватный QueryClient, ticket-only WS. Новые auth-сценарии используют тот же lifecycle | [CORE-MERGE](CORE-MERGE.md), [CONTRACT](CONTRACT.md) |
| Подписка / оплата / профиль | Новая декомпозиция покупки, inline top-up, точный invoice, выбранная подписка и период, Apple Dark, объединённый профиль, INCY/Happ и уведомления 80/90 | [USER-MERGE](USER-MERGE.md), [матрица кастома](CUSTOMIZATION-MATRIX.md) |
| Админка | Новые модули, сохранённые debounce/abort/retry/bulk, права, aliases и signed media; явный UUID/numeric boundary без приведения типов | [ADMIN-MERGE](ADMIN-MERGE.md) |
| Tooling / производительность | Node 24, Router 8, Biome и Vitest; все 11 custom suites в `npm test` и CI. Lazy user/admin locales и исходные bundle budgets сохранены | [CORE-MERGE](CORE-MERGE.md), [bundle metrics](bundle-metrics-final.json), [audit](npm-audit-final.json) |
| Визуальная проверка | 54 снимка: 24 baseline + 30 кандидата, mobile 390×844 и desktop 1440×900; основные экраны, список пользователей, обзор карточки пользователя и её диалог тикета. Исправлены акценты покупки/админки, hairlines и обрезание mobile header | Локальный visual report, описанный ниже |
| Независимые исправления | Reset/Back не возвращает устаревший поиск; ticket GET не затирает reply/status; callbacks прежней подписки изолированы; обновление подписи документа сохраняет popup gesture; health probe при `/api` идёт через API proxy | Отчёты модулей и [health tests](../../src/api/health.proxy.test.ts) |

Все **14** интеграционных флагов по умолчанию выключены. Это локальные настройки выпуска, а не обнаруженные возможности backend и не замена RBAC. Меню, прямые маршруты и запросы учитывают соответствующие флаги. Точный список и условия включения — в [CONTRACT](CONTRACT.md).

## Проверки и оставшиеся границы

Окончательные результаты общей проверки сведены в [FRONTEND-HANDOFF](FRONTEND-HANDOFF.md) и [VERIFICATION](VERIFICATION.md): 151 custom test во всех 11 suites и 1449 Vitest tests в 233 файлах, без failures/skips; type-check, lint, format, build, bundle, browser smoke и nginx runtime — PASS; audit — 0 advisories. Промежуточные запуски владельцев модулей не заменяют этот результат. Исторические 157/157 тестов baseline также не являются проверкой слияния.

Свежая независимая source/security review завершилась PASS: session/auth clock/private QueryClient, consent ownership, ticket-only WS, direct-route gates, explicit panel identity, Dashboard A→B callbacks и signed-document lifecycle. Health proxy и loopback-only nginx fixture исправлены и проверены. Исключений тестов или ослабления общих guards не обнаружено. Это проверка исходников, а не live API.

Визуальные данные находятся вне Git-репозитория кабинета: локальный `work/cabinet-visual-20260928/README.md` и `evidence/` в общей рабочей папке. [Открыть локальный отчёт](../../../cabinet-visual-20260928/README.md) можно только при наличии соседнего каталога. В отдельном clone эта ссылка недоступна; краткий результат сохранён здесь и в handoff. Все 54 итоговых кадра показали 0 browser page errors, 0 неожиданных fixture API-запросов и 0 горизонтальных переполнений. Это Chromium с синтетическими данными и заблокированной внешней сетью. Telegram WebView, нативная клавиатура и все варианты ошибок визуально не подтверждены.

Не выполнены target-bot fixtures, живые REST/WS/media/payment E2E, проверка миграций панели, тестовый deploy и rollback. Новые модули с неподтверждёнными схемами остаются выключенными. Исходная фаза и локальные проверки не означают готовность всей связки к выпуску.

## Продолжение после готовности бота

1. Получить точный SHA бота, схемы/маршруты и migrations; отдельно закрепить версию панели. Текущую Remnawave 2.8.1 не обновлять автоматически.
2. Подготовить синтетические fixtures на основе этих схем: auth/rotation, WS tickets, UUID/numeric identity, payment/подписки, signed media, permissions и планируемые новые возможности.
3. Проверить каждый флаг и включить только подтверждённые контракты, включая доступ по прямому URL; повторить затронутые frontend checks.
4. На тестовом окружении проверить Telegram/Web login, logout/account switch, REST/WS, sandbox top-up/renewal, несколько подписок, media, админские роли и ссылку sub2. Проверить health probe через фактический proxy.
5. Подготовить согласованный тестовый релиз и откат. Сохранить прежние dist/config и старые hashed assets; публиковать assets перед атомарной заменой index.html. Проверить old frontend/new backend: откат frontend не откатывает БД и mapping панели. Каталог dist, уже примонтированный в Caddy, нельзя просто переименовать.

Прод в эту последовательность не входит.
