# Перенос кабинета на upstream 1.79.0: состояние

Дата: 2026-09-28. Текущий статус: **baseline-contract-documentation-ready; target integration pending**. Полный этап 1 не завершён: fixtures и визуальные эталоны ещё не подготовлены.

Принятое уточнение пользователя: новый бот ещё мержится; в этом чате выполнить всё возможное без него, после его готовности продолжить зависимые работы. Разрешены независимые изменения frontend source/tooling/UI/tests/session. Целевые API-схемы, Remnawave ID и live release ожидают бота; текущий бот в этой задаче не изменяется.

## Зафиксированные источники

| Назначение | Значение |
| --- | --- |
| Отдельный checkout | `/Users/a001/Documents/ChatGPT/testbotbedol/work/cabinet-upstream-v1.79.0-20260928` |
| Рабочая ветка | `codex/cabinet-upstream-v1.79.0` |
| HEAD / установленный fork baseline | `55a4038f4ae8692922abc2622f97309840f71064`, package version 1.57.1 |
| Upstream release | tag `v1.79.0` → `f5ea595f8f732c37f2d5c270f34879ab2e2fba2d` |
| Общий предок | `206926a3a315d8c2f6f2c56052f6d147b00dd734` (1.51.0) |
| Origin | `https://github.com/hebu001/bedolaga-cabinet.git` |
| Upstream remote | `https://github.com/BEDOLAGA-DEV/bedolaga-cabinet.git` |
| Текущий бот | 3.66.0, `4b06edcdce26850c03ca474e8d195ef94ddb347e` |
| Целевой бот/schema | Не определены; интеграционная зависимость |
| Панель | Remnawave **2.8.1** закреплена; не обновляется в этой задаче |

Managed `create_worktree` был вызван с baseline SHA и вернул `invalid reference`: root repo не содержит этот commit. Создан отдельный clone из локального `work/cabinet-upstream-audit-20260928/repository.git` через `git clone --no-hardlinks --no-checkout`, затем новая ветка от точного SHA. Это самостоятельный checkout, не managed worktree; dirty clones не использовались. Network fetch не выполнялся: Git objects и tag уже закреплены аудитом. URL remote настроены без push.

## Последовательные gate

| Gate | Требуемый результат | Текущее состояние / блокер |
| --- | --- | --- |
| G0 / изоляция | Отдельная ветка от baseline, pinned upstream, известные sources, нет посторонних правок | Выполнено: clone, refs, merge-base и remotes проверены; исходники не менялись |
| G1a / документирование | Реестр всех инвариантов с источниками/проверками; current/target контракт и границы неизвестного | Подготовлено: [CUSTOMIZATION-MATRIX](CUSTOMIZATION-MATRIX.md), [CONTRACT](CONTRACT.md); требуется отдельная review |
| G1b / визуальный baseline и fixtures | Детерминированные current fixtures и mobile/desktop screenshots; затем target schema fixtures после получения SHA | Pending. Список кадров есть в матрице; снимков/fixtures нет. Это не завершённый phase 1 |
| G2 / инфраструктура и transport | Обычный merge pinned upstream с сохранением истории обоих родителей; осознанные package/tooling/lockfile; оба test suites в CI; session/WS/media invariants | Не начат. Слияние не запускалось. Независимая часть tooling/session может разрабатываться при неизвестном target bot; общая совместимость от этого не считается подтверждённой |
| G3 / подписки, оплата, профиль | Новая декомпозиция upstream, Apple Dark и inline top-up; exact payment identity; target subscription ID, trial, INCY/Happ, profile/80/90 | Не начат. Schema-dependent части требуют подтверждения целевых endpoint/payload/capability; визуальный перенос сверять с G1b |
| G4 / админка и locales | Новая структура admin, сохранённые поиск/bulk/permissions, согласованный panel ID, capability gating, ru/en/fa/zh и lazy admin locales | Не начат. Numeric/UUID и новые modules зависят от контракта бота; возможна независимая работа над подтверждёнными инвариантами |
| G5 / чистая проверка | Clean install на выбранных Node/npm, custom + upstream tests, type-check, lint, build, dependency/nginx checks где применимы, bundle и visual comparisons | Не начат; нельзя объявлять merge проверенным по старому baseline test log |
| G6 / интеграция и тестовый релиз | Согласованные SHA/панель, live E2E test Origin/Telegram/Web/payment/media/roles/sub2, backup и совместимый rollback | Заблокирован неизвестным target bot и невыполненными G3–G5. Ни один сервер не изменён; prod исключён |

Неизвестный целевой бот/schema блокирует **schema-dependent modules, интеграционные проверки и release**, но не независимый перенос tooling и проверенного session transport. На подготовительном шаге действовал отдельный предел: не запускать merge, не менять исходники, не делать commit. Этот предел соблюдён.

При дальнейшем merge не принимать все конфликты одной стороной. Audit preview насчитал 156 конфликтующих путей, но это моделирование bare merge-tree, а не изменения этой ветки. Не представлять промежуточное конфликтное дерево как сборку. Итоговый merge должен сохранять обоих родителей для будущих обновлений.

## Проверки подготовительного шага

- Подтверждены `HEAD`, `refs/tags/v1.79.0^{commit}`, `git merge-base`, имя ветки и оба remote URL.
- Прочитаны применимые AGENTS, исходный audit и bot-contract. В baseline cabinet checkout дополнительных AGENTS.md не найдено.
- Проверены source/test paths матрицы, состав 11 suite baseline `npm test`, сценарии auth/WS/media/payment/connection/admin/startup/trial/login/scroll/aurora.
- После добавления документов выполнены `git diff --check`, `git diff --exit-code`, `git diff --cached --exit-code`; tracked source/index diff и MERGE_HEAD отсутствуют. Обнаружены только три untracked Markdown-файла в `docs/upstream-1.79/`. Все относительные Markdown-ссылки этих документов ведут к существующим файлам/каталогам; object alternates отсутствуют.
- Исторический baseline audit: 157/157 тестов, Node 25.5.0, переиспользованные node_modules при совпадающем lockfile SHA. В этом checkout tests/build/npm install не запускались; результаты нового checkout или merge не заявляются.

Не выполнены: fixtures, screenshots, merge, source edits, commits, push, PR, CI, live API/browser E2E, server access, deployment. Секреты не читались и не сохранялись. Действующая тестовая связка и prod не затронуты.

## Следующий проверяемый шаг

Отдельная review этих трёх документов и точности refs. Затем G1b для current baseline и независимая часть G2 в рамках согласованного плана. Для target fixtures и schema-dependent модулей получить зафиксированный контракт из задачи обновления бота; не выдумывать целевой SHA или версию панели.

При будущем тестовом релизе сохранить старый dist/config; опубликовать hashed assets перед атомарной заменой index.html и оставить старые assets для открытых вкладок. Каталог dist, примонтированный в Caddy, нельзя просто переименовать. Совместимость old frontend/new backend для отката проверяется отдельно; frontend-only rollback не возвращает прежнюю схему БД.
