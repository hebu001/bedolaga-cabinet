# Контракт кабинета 1.79.0 с ботом

Дата: 2026-09-28. Независимый frontend-кандидат подготовлен; целевой бот ещё мержится в другой задаче. Синтетические frontend fixtures и browser-проверки существуют, но схемы завершённого бота ещё не получены. Этот документ не подтверждает совместимость новой живой связки.

| Компонент | Зафиксированная версия |
| --- | --- |
| Установленный frontend / fork baseline | `55a4038f4ae8692922abc2622f97309840f71064`, 1.57.1 |
| Upstream frontend кандидата | tag `v1.79.0`, `f5ea595f8f732c37f2d5c270f34879ab2e2fba2d` |
| Текущий тестовый бот | 3.66.0, `4b06edcdce26850c03ca474e8d195ef94ddb347e`; base `cde43dd6396da5db8ba7492f4693e3be63c5caed` + sync fix |
| Целевой бот | **Ожидается:** репозиторий, SHA, схемы, migrations и доступные возможности |
| Тестовая панель | **Remnawave 2.8.1**, не изменялась |

Кабинет обращается к Cabinet API бота. Remnawave API-токен во frontend не передаётся. Наличие endpoint или номер версии не доказывают совпадение request/response. Исходный аудит относится к зафиксированным SHA, а не к незавершённому дереву соседней задачи.

## Сохранённые обязательные контракты

| Область | Требуемое поведение | Что проверить с целевым ботом |
| --- | --- | --- |
| WebSocket | `POST /cabinet/ws/ticket` с Bearer и browser Origin; ticket одноразовый, TTL 30 секунд. Затем `/cabinet/ws?ticket=...`; новый ticket при reconnect. JWT в query не используется | Origin, TTL, one-use, authentication ack, reconnect и события после смены сессии |
| Refresh / logout | `POST /cabinet/auth/refresh`, body `{refresh_token}`, header `X-Refresh-Token-Rotation: 1`; атомарная смена токенов и межвкладочная синхронизация. `POST /cabinet/auth/logout`, body `{refresh_token}`; late callbacks не восстанавливают завершённую сессию | Rotation/revocation, две вкладки, 401/5xx/timeout, logout/account switch. CloudStorage credential recovery не включать в обход lifecycle |
| Clock / private state | Доступный через CORS HTTP `Date` плюс монотонное время; session generation владеет queries/mutations/permissions | Exposed Date, неверные часы устройства, приватный cache и поздние ответы |
| Signed media | `media_token` и индивидуальные `media_items[].token`; authorized ticket GET обновляет подписи. Bounded retry/singleflight; unsigned fallback отсутствует | Album/single/missing/expired signatures, реальный media fetch и гонки reply/status. Web popup и Telegram opener отдельно |
| Payments | Provider reference отделён от local payment ID; только конкретный server-confirmed invoice означает paid. URL и timeout не подтверждают оплату, ошибка проверки остаётся unknown | Create/resolve/status, ID/URL/amount, ошибки и sandbox каждого включённого метода. `missing_amount` — положительное целое в согласованных единицах |
| Подписки | Query/cache и callbacks привязаны к выбранному subscription ID. Stale/error preview и неизвестный баланс платного trial блокируют оплату | ID в query/body конкретного endpoint; `purchaseTariff` передаёт ID в JSON. One/multiple/legacy, switch/renew/trial и скидки |
| Профиль | Объединены профиль/рефералы/accounts; traffic notifications используют enable flag и фиксированные 80/90 | Реальный payload, linked providers, ID copy, существующие referrals без нового gated API |
| Auth / RBAC | Все входы используют completeLogin/session boundary. Права проверяются независимо от интеграционных флагов | Telegram/OIDC/email/deeplink, обычный/ограниченный/full admin; `*:*` не открывает выключенный модуль |
| Health / proxy | При относительном `VITE_API_URL=/api` liveness идёт на `/api/health/unified`, чтобы prefix-stripping proxy доставил запрос к боту. Для absolute API URL используется origin `/health/unified`; явный `VITE_HEALTH_URL` имеет приоритет | Фактический proxy, 502/503/504 и recovery. HTML frontend SPA не должен подменять проверку backend |

Основные исходники и проверки: [CORE-MERGE](CORE-MERGE.md), [USER-MERGE](USER-MERGE.md), [ADMIN-MERGE](ADMIN-MERGE.md). Нынешние frontend tests проверяют отправляемые значения и lifecycle на mocks; они не удостоверяют, что новый бот уже принимает эти значения.

## Явная идентичность пользователя панели

| Ответ | Активный UUID-контракт | Будущий numeric-контракт |
| --- | --- | --- |
| UserDetail | `remnawave_uuid` | `remnawave_id: number` |
| PanelUserInfo | `uuid` | `id: number` |
| SyncToPanel | `panel_uuid` | `panel_user_id: number` |
| PanelSyncStatus | `remnawave_uuid` | `remnawave_id: number` |

[adminPanelIdentity.ts](../../src/api/adminPanelIdentity.ts) читает выбранную схему, а не угадывает её по наличию полей. При `numericPanelIdentity: false` активен UUID. Отсутствующее ожидаемое поле, чужая схема и строка вместо числа дают contract error; `null` допустим для непривязанного пользователя. Внутренний discriminator `panel_identity` не является новым wire-полем backend. Приведение `Number(uuid)`, cast и эвристика `uuid || id` не используются.

Существующие sync/user actions адресуют `/cabinet/admin/users/{botUserId}`, а не panel ID; optional `subscription_id` сохраняется. Push с `create_if_missing:true` доступен при корректном локальном ID, включая отсутствие пользователя панели. Pull требует реальной привязки. UUID нод и squad не меняются из-за numeric user identity. Mapping и миграции данных панели здесь не выполнялись.

## Все 14 локальных флагов выключены

Источник истины: [integrationCapabilities.ts](../../src/config/integrationCapabilities.ts). Это конфигурация выпуска, а не автоматическое обнаружение backend и не настройка прав пользователя.

| Флаг (сейчас `false`) | Условие включения |
| --- | --- |
| `advancedUserFilters` | Подтвердить новые online/grace/traffic/payment/expiry filters и sort/direction. До этого неподдерживаемые URL-фильтры нормализуются; базовые search/status/tariff/group/campaign работают |
| `legalConsent` | Подтвердить legal API, `accepted_legal_documents` и HTTP 428 consent flow через тот же session owner |
| `coupons` | Подтвердить новые схемы coupon screens/editor. Coupons уже есть в текущем боте; флаг не утверждает отсутствия API и не отключает прежние промокоды |
| `publicEmailResend` | Подтвердить публичный `POST /cabinet/auth/email/register/resend {email}`; authenticated resend — другой контракт |
| `userAvatar` | Подтвердить `GET /cabinet/auth/me/avatar` и `{photo_url}` |
| `liteMode` | Подтвердить lite API/flows; основной кастомный экран не заменяется автоматически |
| `reachability` | Подтвердить routes, responses и permissions `read/run` |
| `reminders` | Подтвердить routes, responses и permissions `read/create/edit/delete` |
| `systemErrors` | Подтвердить routes, responses и permissions `read/manage` |
| `nodeGeoCheck` | Подтвердить GeoCheck API и поддерживаемую версию панели; версия ноды сама по себе недостаточна |
| `numericPanelIdentity` | Зафиксировать numeric wire-схемы и mapping панели; проверить обе явные схемы и ошибки, не преобразовывать UUID |
| `recurringPayments` | Подтвердить новые SBP/Lava purchase/manage/binding contracts. Существующая saved-card функциональность сохранена |
| `referralLevels` | Подтвердить новые referral-level schemas; существующие рефералы работают отдельно |
| `graceAccess` | Подтвердить grace routes, payloads и разрешения |

Защита действует на меню, запросы и соответствующие прямые маршруты; 17 direct-route регрессий проверяют default-off поведение для авторизованного администратора. Изменить только frontend-флаг недостаточно для выпуска.

По исходному аудиту текущий бот уже имеет coupons, `partners:settings`, panel recap/devices-stats/top-consumers/health/subscription-requests. Для них нужна сверка схем, а не утверждение, что API отсутствует. Новые reachability/reminders/system-errors/legal/public resend/avatar отсутствовали в зафиксированной текущей версии. Эти сведения не заменяют проверку завершённого целевого бота.

## Fixtures и переход к тестовому релизу

Уже существуют типизированные [purchase fixtures](../../src/components/subscription/purchase/customFlow.fixtures.ts), DOM/query/API mocks и локальный browser harness. Они построены по frontend-контрактам и подтверждают frontend-поведение. Визуальная проверка содержит 54 итоговых кадра, включая Users, обзор UserDetail и его вкладку тикетов; данные и токены синтетические, внешние HTTP/WS заблокированы. Local artifact: `work/cabinet-visual-20260928/README.md` в общей рабочей папке, вне этого Git repo.

**Target-bot fixtures ещё не созданы.** Для каждого нужны schema SHA/path, HTTP method/path, query/body/headers, success/error responses и соответствующий флаг. Минимум: UUID/numeric, rotation/revocation, WS issue/reconnect, media single/album/expiry, payment create/resolve/status, one/multiple/legacy subscriptions и trial, limited/full permissions, включённые/выключенные возможности, legal 428.

После получения SHA: сверить схемы → создать fixtures → проверить нужные флаги → пройти live E2E на тестовых Origins → подготовить backup и совместимый rollback → выполнить согласованный тестовый deploy. Отдельно проверить old frontend/new backend. Frontend rollback не откатывает migrations БД или mapping панели. Prod не меняется; независимая frontend-фаза не означает test deployment.
