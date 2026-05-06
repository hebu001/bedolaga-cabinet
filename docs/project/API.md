# API — Bedolaga Cabinet

> [!NOTE]
> Backend код недоступен. Все контракты восстановлены из `src/api/*.ts` и `src/types/index.ts`.
> Статус: `[inferred from frontend]`

## Базовая конфигурация

```
Base URL:    VITE_API_URL + /cabinet/  (production: https://miniapp.evovpn.ru/api/cabinet/)
Auth:        Authorization: Bearer {accessToken}
CSRF:        X-CSRF-Token: {token}  (POST/PUT/DELETE/PATCH)
TG Header:   X-Telegram-Init-Data: {initData}  (Telegram auth endpoints)
Timeout:     см. config/constants.ts → API.TIMEOUT_MS
```

## Auth Endpoints
→ Подробно в `.claude/rules/api.md`

## User Endpoints

### Subscription (`src/api/subscription.ts`)
```
GET  /cabinet/subscription/status           → SubscriptionStatusResponse
GET  /cabinet/subscription/purchase-options → PurchaseOptions
POST /cabinet/subscription/purchase-preview → PurchasePreview
POST /cabinet/subscription/purchase
POST /cabinet/subscription/renew
POST /cabinet/subscription/switch-tariff
POST /cabinet/subscription/autopay/enable
POST /cabinet/subscription/autopay/disable
```

### Balance (`src/api/balance.ts`)
```
GET    /cabinet/balance                  → Balance
GET    /cabinet/balance/transactions     → PaginatedResponse<Transaction>
GET    /cabinet/balance/payment-methods  → PaymentMethod[]
POST   /cabinet/balance/topup
GET    /cabinet/balance/saved-cards      → SavedCardsResponse
DELETE /cabinet/balance/saved-cards/{id}
GET    /cabinet/balance/pending          [assumption]
POST   /cabinet/balance/pending/{id}/check [assumption]
```

### Connection / Apps (`src/api/adminApps.ts`)
```
GET /cabinet/connection/apps → AppConfig (RemnaWave format)
```

### Support (`src/api/tickets.ts`)
```
GET  /cabinet/support/config       → SupportConfig
GET  /cabinet/tickets              → PaginatedResponse<Ticket>
POST /cabinet/tickets              (создать)
GET  /cabinet/tickets/{id}         → TicketDetail
POST /cabinet/tickets/{id}/messages
GET  /cabinet/ticket-notifications
POST /cabinet/ticket-notifications/read-all
```

### Other
```
GET  /cabinet/referral/info       → ReferralInfo
GET  /cabinet/referral/terms      → ReferralTerms
POST /cabinet/referral/partner/apply
POST /cabinet/referral/withdrawal/request
GET  /cabinet/wheel/status
POST /cabinet/wheel/spin
GET  /cabinet/gift
GET  /cabinet/polls
GET  /cabinet/contests
GET  /cabinet/info
```

## Admin Endpoints

Все требуют `isAdmin=true` + соответствующий permission:

```
/cabinet/admin/dashboard, /stats, /users, /tariffs, /servers
/cabinet/admin/payments, /payment-methods
/cabinet/admin/promocodes, /promo-groups, /campaigns
/cabinet/admin/partners, /withdrawals
/cabinet/admin/tickets, /broadcasts, /wheel
/cabinet/admin/ban-system, /remnawave
/cabinet/admin/email-templates, /settings, /apps
/cabinet/admin/landings, /roles, /policies, /audit-log
/cabinet/admin/promo-offers, /pinned-messages
/cabinet/admin/channel-subscriptions
/cabinet/admin/traffic-usage, /sales-stats, /updates
```

## Response shapes (confirmed from types)

```typescript
// Auth success
{ access_token, refresh_token, token_type, expires_in, user: User, campaign_bonus? }

// Paginated
{ items: T[], total, page, per_page, pages }

// Blocking errors
503: { detail: { code: "maintenance", message, reason? } }
403: { detail: { code: "channel_subscription_required"|"blacklisted", ... } }
401: → автоматический token refresh

// Standard error [assumption - FastAPI style]
{ detail: string | { field: message } }
```
