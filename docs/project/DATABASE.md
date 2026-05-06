# DATABASE — Bedolaga Cabinet

> [!CAUTION]
> База данных находится на backend-сервере `bed.evovpn.ru`. Прямого доступа нет.
> Всё ниже — `[inferred from frontend types and API]`.

## Тип БД: [unknown]

## Доменная модель (восстановлена из src/types/index.ts)

### User
```typescript
{
  id: number
  telegram_id: number | null
  username: string | null
  first_name: string | null
  last_name: string | null
  email: string | null
  email_verified: boolean
  balance_kopeks: number
  balance_rubles: number
  referral_code: string | null
  language: string
  created_at: string
  auth_type: 'telegram' | 'email' | 'google' | 'yandex' | 'discord' | 'vk'
}
```

### Subscription
```typescript
{
  id, status, is_trial, start_date, end_date, days_left
  traffic_limit_gb, traffic_used_gb, traffic_used_percent
  device_limit, connected_squads: string[], servers: ServerInfo[]
  autopay_enabled, subscription_url
  tariff_id?, tariff_name?, is_daily?
}
```

### Tariff
```typescript
{
  id, name, description, tier_level
  traffic_limit_gb, device_limit, servers_count
  periods: TariffPeriod[]  // цены по периодам
  is_daily, daily_price_kopeks
  custom_days_enabled, custom_traffic_enabled
}
```

### Transaction
```typescript
{
  id, type, amount_kopeks, amount_rubles
  description, payment_method, is_completed
  created_at, completed_at
}
```

### Ticket / TicketMessage
```typescript
Ticket: { id, title, status, priority, created_at, messages_count }
TicketMessage: { id, message_text, is_from_admin, has_media, ... }
```

### PaymentMethod
```typescript
{
  id, name, description
  min_amount_kopeks, max_amount_kopeks
  is_available, options?
  user_type_filter: 'all' | 'telegram' | 'email'
}
```

## Связи между сущностями (inferred)

```
User 1:N Subscription
User 1:N Transaction
User 1:N Ticket
Subscription N:1 Tariff
Subscription N:M Server (через connected_squads / servers[])
```

## Уровень уверенности

| Сущность | Уверенность | Источник |
|---|---|---|
| User | HIGH | src/types/index.ts + GET /cabinet/auth/me |
| Subscription | HIGH | src/types/index.ts + API |
| Tariff | HIGH | src/types/index.ts |
| Transaction | MEDIUM | src/types/index.ts |
| Ticket | MEDIUM | src/types/index.ts |
| PaymentMethod | MEDIUM | src/types/index.ts |
| Role/Permission | LOW | src/api/rbac.ts endpoint structure |
