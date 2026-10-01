# Адаптация кабинета к завершённому боту

## Тестовый контракт кабинета 1.80.1 с ботом 5.0.0 — 2026-10-01

Кабинет: ветка `codex/cabinet-upstream-v1.80.1`, поверх `2e66de444583949f69890d13f85e193619ac2ea8`. Живой тестовый API: `https://bed.evoevoevo.com`, бот `961b2aaabca67a42d013e196c65213d7ebe47f3d` (5.0.0), образ `test-bedolaga-bot:961b2aaa`, проверенный image ID `sha256:4e10b5a494aea1dd25efb22cfe3d41014163b239794891b9cd68fdc3c40edbdc`.

**25/25 проверок контракта PASS.** Только `casheraRecurringPayments`, `dpichecker` и `broadcastAudience` переведены в `true`; это техническая совместимость кабинета с API. Старый `recurringPayments` остаётся `false`, состояние остальных флагов не меняется. Runtime-флаги, наличие конфигурации, RBAC и владение сессией/подпиской продолжают ограничивать доступ независимо от конфигурации выпуска.

| Контракт | Живая проверка и границы |
| --- | --- |
| DPI//CHECKER | Admin GET status: 200, `enabled=false`, `configured=false`; anonymous 401, обычный пользователь 403. `DPICHECKER_ENABLED`: категория `DPICHECKER`, тип `bool`, `current=false`, `read_only=false`, **`env_locked=true`**. Раздел доступен читателю для настройки; платные вкладки и ссылки остаются скрыты по runtime-статусу. ENV-lock скрывает быстрый переключатель в настройках независимо от frontend-флага; его нельзя снять правкой кабинета. |
| Аудитория рассылок | Admin users GET и читающий preview POST: 200, схемы совпали; anonymous 401, обычный пользователь 403. Поиск пользователей требует `broadcasts:read` и `users:read`; preview требует `broadcasts:read`, список получателей скрывается без `users:read`. Схема audience проверена в развёрнутом `CombinedBroadcastCreateRequest`; реальная рассылка не создавалась. |
| Cashera recurring | Purchase options явно возвращает `cashera_recurrent_enabled=false`; отключённый status отвечает 403. Схемы развёрнутого кода подтверждают purchase только с `tariff_id` и cancel без проверки provider enabled, с авторизацией и проверкой владения. Frontend не включает provider и не запрашивает status/enable при false-флаге; отмена остаётся доступна. Реальные purchase/enable/cancel не вызывались. |
| Существующие API | Auth, balance, subscription, payment methods и numeric panel identity прошли живую сверку. `TopUpResponse`: обязательный `payment_url`, nullable `qr_payload`; схема проверена без создания счёта. |

Артефакты вне Git кабинета: `work/cabinet-v1.80.1-api-contract-20261001/live-result-961b2aaa.json`, проверочный скрипт и README рядом. Для выборки существующих аккаунтов использована транзакция READ ONLY; JWT только в памяти. Запросы — GET и один семантически читающий audience preview POST; обычные API могли обновить штатные метки активности/журналы доступа. **Бизнес-мутаций 0:** функциональные данные, настройки провайдеров, платежи, задания и рассылки намеренно не изменялись; код и конфигурация бота не менялись. Frontend-тесты по-прежнему используют synthetic fixtures и не подтверждают фактическую оплату/DPI-запуск.

## Историческая интеграция 1.79.0 — 2026-09-28

Дата: 2026-09-28. Кабинет на ветке `codex/cabinet-upstream-v1.79.0`, поверх merge `14a8bebcc2c64d549971abef6bee7b76cc9517f4`. Целевой бот: `hebu001/remnawave-bedolaga-telegram-bot`, ветка `codex/bot-upstream-v4.15.0`, коммит `741feec565f9c7046ab73566d61f4a9d7fdf68f4`, подтверждённый remote и локальным Git.

OpenAPI экспорт был подготовлен для `6d402805079fcfb98f3faefa2d359ed94e389c5a`. Из runtime кода кабинета между ним и итоговым SHA изменён только `app/cabinet/routes/gift.py` (также менялись тесты и документы): D02/D05 восстанавливает полную историю подарков и короткие публичные коды. Схемы сохранены. Итоговый source рассмотрен отдельно от старого экспорта.

## Что изменено

- Включён только `numericPanelIdentity`. Карточка, поиск Telegram, sync status/from/to читают поля `remnawave_id`, `id`, `panel_user_id` с явной проверкой типов. Сохранена обработка отсутствующей привязки; UUID не превращается в число. Остальные 13 flags false.
- Кастомный профиль показывает дни, деньги и смешанные награды, тариф/уровень истории, суммарные дни. Уровневая схема использует существующий ленивый ProgrammeTerms с отдельной Apple orange/gray палитрой; stats/share больше не обещают устаревший плоский процент. Основной профиль и referralLevels gate сохранены.
- Новости: ввод excerpt ограничен 1000 Unicode code points, сохранение старой длинной записи блокируется без автоматического изменения текста. Тег ограничен 50 для создания и выбранной записи. Структурированные 422 показывают поле/причину, ошибки доступны как alert.
- Поздний `tariff_required` закрывает устаревшую докупку и возвращает к выбору тарифа для конкретной подписки, с session/subscription ownership fencing. Такой отказ не создаёт счёт.
- Gift fixtures/comments отражают 12-символьный код, legacy aliases и canonical links. Исходник итогового бота сохраняет все шесть статусов истории; это отдельная source-проверка, не шесть новых frontend fixtures. Проверка ownership и фактическая активация/оплата остаются обязанностью backend; live-проверка не заявляется.
- Удалён неиспользуемый wrapper отсутствующего `/cabinet/admin/broadcasts/email`; рабочий combined `/send` сохранён.

## Проверки

Новые focused DOM/contract проверки покрывают reward days/mixed/money, excerpt/tag boundaries и 422, numeric identity, gifts и поздний tariff_required. Полный повторный запуск: **151 custom + 1484 Vitest = 1635 tests PASS**, без failed/skipped. Type-check, lint, format, build и bundle budget — PASS после финальных presentation-правок. Vitest: 238 файлов. Lint: 0 errors, 271 warnings и 114 informational diagnostics. Initial bundle: **893183 raw / 284650 gzip bytes** при исходных лимитах 900000 / 285000. Локали raw/gzip: ru 119321/29500, en 77939/23249, fa 103770/25979, zh 70236/23718. Лимиты не повышались; зависимости не менялись.

Машинный итог и логи: локальный `work/cabinet-bot-integration-20260928/verification.json` и `status.tsv` с соседними логами проверки. Source manifest: 1073 файла, SHA-256 `cc8bb2c61fc86cb81f024579aaac1e83fa944c0bbdadedf721d09f55a04f70f4`; исходники не менялись во время финального запуска. Они находятся вне Git-репозитория кабинета; приведённые здесь результаты доступны и в отдельном clone.

Synthetic Chrome: **12 captures** на mobile 390×844 и desktop 1440×900 (профиль/рефералы, прокрутка к дням/смешанным выплатам, редактор новости и server422). 0 page errors, 0 неожиданных fixture endpoints, 0 horizontal overflow. Фактические изображения просмотрены: оранжево-серые условия уровней, +7 дней с тарифом, смешанные +5 ₽ +14 дней, сумма +21 день и видимый error alert. В news принят ввод 600 emoji со счётчиком 600/1000; ответ 422 синтетически задан независимо от валидности ввода. HTTP наружу и все WebSocket заблокированы; локальный proxy направлен на закрытый loopback port9. Локальные evidence: `work/cabinet-bot-integration-20260928/evidence/`, harness рядом; эти файлы вне репозитория кабинета. Исторические 1600 tests, 54 снимка и nginx/dependency smoke из VERIFICATION относятся к merge 14a8bebc, а не выдаются за новый запуск.

## Границы

Менялись только локальные исходники кабинета, тесты и документы. Серверы, прод, бот, БД и панель не менялись. Тестовая Remnawave остаётся 2.8.1: выбор numeric HTTP-контракта не подтверждает совместимость этой панели с новым ботом и не заменяет его migrations/backfill. Live REST/WS, Telegram WebView, реальные платежи, медиа, sync и тестовый deploy/rollback требуют отдельной проверки. Секреты не включены в артефакты.
