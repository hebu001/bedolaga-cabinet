# Кабинет 1.79.0: передача к интеграции с ботом

Дата: 2026-09-28. Подготовлен локальный frontend-кандидат на ветке `codex/cabinet-upstream-v1.79.0`: кастом EvoVPN перенесён с `55a4038f` на upstream **1.79.0** (`f5ea595f`). Пользовательские экраны, inline top-up, session/WS/media защита и админские сценарии сохранены при новой структуре upstream.

Независимая frontend-проверка пройдена; результаты подготовлены для интеграции с ботом. Этап оформляется обычным merge с двумя родителями: `b1a44d3769fa90f73c86c08db09bed843884f237` и `f5ea595f8f732c37f2d5c270f34879ab2e2fba2d`; итоговый commit — в `git show` этой ветки и итоговой выдаче задачи. Это завершение независимой frontend-работы, **не установка на тестовый сервер и не подтверждение совместимости нового бота**. Установленный кабинет остаётся на 1.57.1. Тестовая Remnawave закреплена на 2.8.1; серверы и прод не менялись.

## Что проверено

| Проверка | Результат |
| --- | --- |
| Чистая установка | Node 24.19.0 / npm 11.8; `npm ci` со scripts enabled и `HUSKY=0`, 471 package |
| Полный `npm test` | **151 custom test во всех 11 suites + 1449 Vitest tests в 233 файлах; 0 failed, 0 skipped** |
| TypeScript / lint / format / build / bundle | Все команды завершились успешно. Lint: 0 errors, 271 warnings, 114 informational diagnostics |
| Browser dependency smoke | 7 проверок PASS, локальный Chrome |
| Nginx runtime | 4/4 PASS на изолированном official nginx 1.30.5 в `/tmp`; без Docker и системной установки |
| Dependency audit | 0 advisories для зафиксированного lockfile |
| Bundle | Initial **893183 raw / 284650 gzip** bytes при исходных лимитах 900000 / 285000. Все ru/en/fa/zh укладываются в 120000 / 30000 |
| Независимая source/security review | PASS: auth/session/clock/private cache, consent ownership, WS tickets, direct-route gates, explicit ID, subscription races и signed-media lifecycle; guards/test suites не ослаблены |
| Визуально | 54 снимка (24 baseline + 30 candidate) на mobile/desktop: основные экраны, список пользователей, обзор карточки пользователя и её диалог тикета; 0 page errors, 0 неожиданных fixture API requests, 0 horizontal overflow |

Значения user locale raw/gzip: ru 119321/29500, en 77939/23249, fa 103770/25979, zh 70236/23718 bytes. Запас initial gzip — только 350 bytes: после следующих source-изменений размер нужно измерять снова, лимиты не повышались.

Health probe исправлен для deployment с `VITE_API_URL=/api`: запрос идёт через `/api/health/unified` к backend, а не в SPA. Четыре actual-HTTP regression tests проходят; две проблемные конфигурации воспроизводили ошибку до исправления. Nginx fixture ограничен loopback-only адресом.

Визуальная проверка обнаружила и исправила синие selected-period акценты на custom orange/white, палитру admin avatars/surfaces, слишком яркие hairlines и обрезание mobile header. Новая компоновка покупки upstream сохранена; pixel-identical результат не заявляется. Также исправлены late callbacks прежней подписки, поиск после Reset/Back, ticket GET после reply/status и открытие документа после обновления подписи.

После финальных 13 presentation-only правок админки повторены весь `npm test`, type-check, lint, format, build и bundle; все прошли. Изменения не затронули зависимости, proxy или transport, поэтому предыдущие clean install/audit/nginx/browser dependency checks сохранены как применимые.

Подробный воспроизводимый итог: [VERIFICATION](VERIFICATION.md) и [machine evidence](VERIFICATION.json). Общие логи находятся в локальном артефакте `work/cabinet-final-verification-20260928/` (`commands.jsonl` и `*.log`), снимки — `work/cabinet-visual-20260928/`. Это соседние каталоги общей рабочей папки, не часть Git-репозитория. Краткие результаты выше остаются доступными в отдельном clone; machine bundle/audit сохранены в [bundle-metrics-final.json](bundle-metrics-final.json) и [npm-audit-final.json](npm-audit-final.json).

## Что ещё не проверено

- Схемы завершённого целевого бота, его migrations и target-bot fixtures; живые REST/WS, подписанные media, sandbox payments, sync и link sub2.
- Telegram native WebView, provider navigation, клавиатура/touch, production fonts/branding и весь набор визуальных error/empty/admin states.
- Node 26, Docker image/runtime и удалённый CI. Локальный nginx runtime test не равнозначен проверке Docker deployment.
- Тестовый deploy, совместимость старого frontend с новым backend и практический rollback.

## Что нужно от готового бота

Получить точный SHA и схемы запросов/ответов, migrations и согласованную версию панели. Затем создать fixtures из этих схем, проверить auth rotation/WS tickets/payment identity/media/подписки/permissions и включать лишь подтверждённые возможности. Сейчас **все 14 integration flags false**, активен явный UUID-контракт; наличие `*:*` не обходит эти ограничения. Полный список — [CONTRACT](CONTRACT.md).

После этого пройти live E2E только на тестовой связке, подготовить backup dist/config и совместимый rollback, затем переходить к тестовому релизу. Frontend rollback не откатывает БД или panel identity. Prod остаётся вне задачи.

Подробности: [состояние и refs](PROGRESS.md), [матрица сохранённого кастома](CUSTOMIZATION-MATRIX.md), [core](CORE-MERGE.md), [user flows](USER-MERGE.md), [admin](ADMIN-MERGE.md). Исторические промежуточные числа в отчётах модулей не заменяют финальный общий запуск, приведённый здесь.
