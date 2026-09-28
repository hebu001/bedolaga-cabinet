# Контракт кабинета 1.79.0 с ботом

Дата: 2026-09-28. Статус: зафиксирован текущий контракт; целевой бот и его schema fixtures ещё неизвестны. Это документ подготовки, а не подтверждение совместимости новой связки.

Пользователь подтвердил, что новый бот ещё мержится. В кабинете продолжается вся независимая frontend-работа; к целевым схемам и live-интеграции вернёмся после готовности бота. Текущий бот не меняется.

| Компонент | Зафиксированная версия |
| --- | --- |
| Baseline frontend | `hebu001/bedolaga-cabinet`, `55a4038f4ae8692922abc2622f97309840f71064`, 1.57.1 |
| Target frontend | `BEDOLAGA-DEV/bedolaga-cabinet`, tag `v1.79.0`, `f5ea595f8f732c37f2d5c270f34879ab2e2fba2d` |
| Текущий тестовый бот | 3.66.0, `4b06edcdce26850c03ca474e8d195ef94ddb347e`; base `cde43dd6396da5db8ba7492f4693e3be63c5caed` + исправление sync |
| Целевой бот | **Не определён**: нужны репозиторий, SHA, версии схем, migrations и capabilities из задачи бота |
| Текущая тестовая панель | **Remnawave 2.8.1, не менять** в задаче кабинета |

Кабинет обращается к Cabinet API бота; API-токен Remnawave во frontend не передаётся. Прод не изменяется. Основание: [аудит](../../../cabinet-upstream-audit-20260928/audit.md), [исходный контракт](../../../cabinet-upstream-audit-20260928/bot-contract.md), точные исходники указанных SHA. Наличие routes и backend version сами по себе не доказывают совпадение response shape.

## Обязательная совместимость

| Область | Текущий контракт / обязательное поведение | Источник и будущая проверка |
| --- | --- | --- |
| WebSocket | `POST /cabinet/ws/ticket` с Bearer и настоящим browser Origin выдаёт ticket на 30 секунд, одноразовый. Подключение `/cabinet/ws?ticket=...`, новый ticket при reconnect; `?token=JWT` запрещён | Bot `app/cabinet/routes/websocket.py:130,146`, `auth/ws_tickets.py`; frontend `src/utils/cabinetWebSocket.ts`. Mock URL/lifecycle tests + integration Origin/expiry/one-use |
| Refresh | `POST /cabinet/auth/refresh`, body `{refresh_token}`, opt-in header `X-Refresh-Token-Rotation: 1`. Access и refresh сохраняются атомарно, межвкладочная синхронизация не теряется | Bot `app/cabinet/routes/auth.py:1796,1863`; frontend `src/utils/token.ts`. Rotation race/401/5xx fixtures и два browser context |
| Logout | `POST /cabinet/auth/logout`, body `{refresh_token}`; revocation/auth_version и session generation исключают восстановление завершённой сессии late refresh/login | Bot `routes/auth.py:1881`; frontend session tests. Отдельно проверить upstream CloudStorage recovery, прежде чем включать |
| Clock | Доверенный HTTP `Date`, доступный frontend через CORS, плюс монотонное истечение | `src/utils/authClock.ts`; unit skew/invalid Date и интеграционная проверка exposed headers |
| Ticket media | Индивидуальные `media_token` / `media_items[].token`, authorized GET ticket обновляет подписи. Unsigned URLs не обслуживаются | `docs/mandatory-fixes-phase3.md`, `src/api/tickets.ts`; album/single/missing/expired fixtures и media fetch |
| Payments | Provider reference и local payment ID различаются; конкретный invoice проверяется по согласованным ID/URL/amount. Return URL и timeout не означают paid | `src/api/balance.ts:46,157`, `test/payment-flow.test.mjs`; create/resolve/status fixtures для методов целевого бота |
| Subscription ID | Расположение ID зависит от endpoint: большинство текущих операций использует query `subscription_id`; upstream `purchaseTariff` также передаёт ID в JSON body. Следовать реальной схеме конкретного маршрута | Fork `src/api/subscription.ts:16`, upstream `src/api/subscription.ts:492`; request/response fixtures one/multiple subscriptions |
| Traffic notifications | Enable flag и фиксированные пороги 80/90. Произвольный threshold control не возвращать без изменения логики бота | Fork `src/pages/Profile.tsx`, commit `55a4038f`; профиль on/off fixtures и backend payload |
| Core auth/RBAC | Telegram/OIDC/email, deeplink request/poll, `/me`, `/me/is-admin`, `/me/permissions` имеются в текущем боте; core RBAC API одинаков в snapshot кабинета | Проверить все новые входы через custom session boundary; ordinary/limited/full admin. `*:*` не заменяет наличие capability |

Ссылки на `app/...` относятся к зафиксированному checkout бота, а не к этому frontend repo. Они не означают, что актуальный upstream bot уже проверен.

## UUID против числовой идентичности панели

| Текущий бот 3.66.0 / панель 2.8.1 | Upstream frontend 1.79.0 |
| --- | --- |
| `UserDetail.remnawave_uuid` | `UserDetail.remnawave_id: number` или null |
| `PanelUserInfo.uuid` | `PanelUserInfo.id: number` |
| `SyncToPanel.panel_uuid` | `SyncToPanel.panel_user_id: number` или null |
| `PanelSyncStatus.remnawave_uuid` | `PanelSyncStatus.remnawave_id: number` или null |

Источник: bot `app/cabinet/schemas/users.py:275,680,728,738`; upstream `src/api/adminUsers.ts:155,287,311,319`, `CHANGELOG.md:415` (переход на Remnawave 3.0).

До согласования нового бота текущие UUID сохраняются. UUID нельзя переименовать в number, преобразовать через `Number(uuid)` или скрыть несовместимость TypeScript cast. Если нужен временный dual support, согласовать явные схемы и discriminator/capability, добавить fixtures обеих схем. Эвристика `uuid || id` не является контрактом. Реальное mapping/migration данных панели относится к отдельной задаче; кабинет не запускает такое преобразование.

## Optional capabilities: не включать только по наличию frontend-кода

| Возможность upstream | Текущий бот, по аудиту | Решение до включения |
| --- | --- | --- |
| Legal consent: `GET /cabinet/info/legal-consent?language=ru`, `accepted_legal_documents`, HTTP 428 | Отсутствует | Backend implementation + fixtures или прежний login flow. Ответ consent `{required,prechecked,documents}`, 428 `detail.code/message/documents/missing/prechecked`; повторяет тот же login с acceptance |
| Public `POST /cabinet/auth/email/register/resend {email}` | Отсутствует; authenticated `/email/resend` — другой маршрут | Перенести или скрыть новый сценарий; не подменять endpoints |
| `GET /cabinet/auth/me/avatar` → `{photo_url}` | Отсутствует | Backend или корректный fallback |
| Reachability (`read/run`), reminders (`read/create/edit/delete`), system errors (`read/manage`) | Routes/permissions отсутствуют | Backend routes + registry + permissions либо явно скрытые разделы |
| Coupons и `partners:settings` | Уже есть | Проверить новые поля/поведение, не считать отсутствующими по diff UI |
| Panel recap/devices-stats/top-consumers/health/subscription-requests | Routes есть, `routes/admin_remnawave.py:244–298` | Сверить response shape с целевым backend/panel |
| Node GeoCheck `POST /admin/remnawave/nodes/{uuid}/geocheck`, `GET /geocheck/{jobId}` | Нет; upstream указывает Remnawave 3.3.0 | Отдельная capability; не показывать на текущей связке |
| Platega/Lava recurrent, lite mode, новые referral/grace/tariff/legal API | Полная схемная сверка не выполнена | Pending: изучить целевой бот. Lite mode не должен автоматически заменить основной кастомный экран |

## Fixtures и release gate

Fixtures ещё не созданы. Их будущие примеры должны быть синтетическими, без реальных пользователей, ключей и подписочных ссылок. Для каждого набора нужны: источник schema SHA/path, HTTP method/path, request body/query/headers, success/error shape и capability. Не выдавать hand-written mock за подтверждённый ответ целевого бота.

Минимальная матрица: current UUID vs согласованная target identity; refresh rotation/revocation; ticket issue/reconnect; media single/album/expiry; payment create/resolve/status; one/multiple subscriptions и trial; limited/full permissions; optional capability present/absent; legal consent/428 при её переносе.

Неизвестный целевой бот блокирует выбор schema-dependent modules, live E2E и release. Он **не блокирует** независимый перенос tooling, сохранение custom test suites и проверенного session/WS transport на подтверждённом текущем контракте. Такой перенос не объявляется доказательством общей совместимости.

Перед совместным тестовым релизом требуются закреплённые SHA, fixtures и migrations; оба набора тестов; проверка ID mapping без потери пользователей/подписок/балансов; REST/WS на test Origin; Telegram/Web login, sandbox top-up/renewal, media и роли; ссылка sub2; проверка старого frontend с новым backend для rollback. Frontend rollback не откатывает DB migration или panel identity.
