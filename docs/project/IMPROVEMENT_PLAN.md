# IMPROVEMENT PLAN — Bedolaga Cabinet

## Краткосрочные (1-2 недели)

### 1. Security Headers в Caddy [P1]
```caddyfile
miniapp.evovpn.ru {
    header {
        X-Frame-Options "DENY"
        X-Content-Type-Options "nosniff"
        Referrer-Policy "strict-origin-when-cross-origin"
        Permissions-Policy "camera=(), microphone=(), geolocation=()"
    }
    # ... остальной конфиг
}
```
**Эффект**: Устранение класса атак, улучшение security score.

### 2. Исправить nginx.conf [P2]
Строки 13-21 в nginx.conf — убрать proxy_pass в try_files блоке:
```nginx
location /api/ {
    return 404;  # или просто убрать блок
}
```
**Эффект**: Правильная работа cabinet_frontend варианта деплоя.

### 3. Добавить Sentry или аналог [P2]
```typescript
// main.tsx
import * as Sentry from '@sentry/react';
Sentry.init({ dsn: import.meta.env.VITE_SENTRY_DSN });
```
**Эффект**: Видимость ошибок в production.

## Среднесрочные (1-2 месяца)

### 4. Разбить App.tsx на Route Groups [P1]
```typescript
// src/routes/userRoutes.tsx
// src/routes/adminRoutes.tsx
// src/routes/authRoutes.tsx
// App.tsx — импортирует группы
```
**Эффект**: Устранение GOD file, улучшение DX, снижение конфликтов в git.

### 5. Написать базовые тесты [P1]
Приоритет:
- unit tests: src/store/auth.ts, src/api/client.ts, src/utils/token.ts
- integration: login flow, route guards
**Инструменты**: Vitest + React Testing Library

### 6. Разбить types/index.ts по доменам [P2]
```typescript
// src/types/auth.ts   → User, AuthResponse, Token...
// src/types/subscription.ts → Subscription, Tariff...
// src/types/index.ts  → re-export all
```

### 7. CI/CD [P2]
GitHub Actions workflow:
```yaml
- lint + type-check
- docker build (проверка)
- deploy на self-hosted runner
```

## Долгосрочные (3-6 месяцев)

### 8. Рефакторинг AdminUserDetail.tsx [P2]
114KB — разбить на sub-компоненты с независимой загрузкой данных.

### 9. HttpOnly Cookie для refreshToken [P3]
Требует координации с backend. Наиболее правильное решение security.

### 10. SSR / Prerendering [P3]
Для улучшения SEO и initial load (маловероятно нужно для Telegram WebApp).

## Ускорение онбординга

1. **✅ СДЕЛАНО**: Project memory (CLAUDE.md + docs/project/* + .claude/rules/*)
2. **[ ]** Написание README-DEV.md с шагами локального запуска
3. **[ ]** docker-compose для локальной разработки с mock backend

## Метрики успеха

| Метрика | Текущее | Целевое |
|---|---|---|
| Время онбординга нового разработчика | ~1 день | ~2 часа |
| Время обновления production | ~5 мин | ~2 мин (CI/CD) |
| Ошибки без алертинга | 100% | 0% |
| Тестовое покрытие | 0% | 30%+ |
