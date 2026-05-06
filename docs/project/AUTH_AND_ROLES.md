# AUTH AND ROLES — Bedolaga Cabinet

## Методы входа

| Метод | Route | Endpoint | Описание |
|---|---|---|---|
| Telegram WebApp | `/login` | POST /cabinet/auth/telegram | Основной в Telegram-контексте |
| Telegram Widget | `/login`, `/auth/telegram` | POST /cabinet/auth/telegram/widget | Для веб-браузера |
| Telegram OIDC | `/login` | POST /cabinet/auth/telegram/oidc | id_token |
| Email/Password | `/login` | POST /cabinet/auth/email/login | Для email-пользователей |
| OAuth | `/auth/oauth/callback` | POST /cabinet/auth/oauth/{provider}/callback | Google, Yandex, Discord, VK |
| Auto-login | `/auto-login` | POST /cabinet/auth/login/auto | Токен от бота |

## Auth Flow (детально)

```
App load
  └── useAuthStore.initialize() (вызывается при импорте store/auth.ts)
        ├── Нет refreshToken → isAuthenticated=false → redirect to /login
        ├── accessToken невалиден →
        │     GET /cabinet/auth/refresh → новый accessToken
        │     GET /cabinet/auth/me → User
        │     GET /cabinet/auth/me/is-admin → isAdmin
        │     если isAdmin → GET /cabinet/auth/me/permissions
        └── accessToken валиден (попробовать напрямую) →
              GET /cabinet/auth/me
              GET /cabinet/auth/me/is-admin
              [если 401] → refresh → повтор

Login success (любой метод):
  → tokenStorage.setTokens(access, refresh)
  → set({user, isAuthenticated: true, pendingCampaignBonus})
  → checkAdminStatus()
  → [if admin] fetchPermissions()
  → navigate to returnUrl or '/'
```

## Token Storage

| Токен | Storage | Key | Lifetime |
|---|---|---|---|
| accessToken | sessionStorage | `cabinet_access_token` | ~15 мин (backend) |
| refreshToken | localStorage | `cabinet_refresh_token` | ~7 дней (backend) |
| telegramInitData | sessionStorage | `tg_init_data` | до закрытия вкладки |
| user (Zustand persist) | localStorage | `cabinet-auth` (только user obj) | постоянно |

## Роли

### Базовые
- **User** — обычный пользователь (isAuthenticated=true, isAdmin=false)
- **Admin** — администратор (isAuthenticated=true, isAdmin=true)

### RBAC (только для admins)
Администраторы имеют набор permissions с поддержкой wildcard:
- `*:*` — полный доступ
- `domain:*` — полный доступ к домену
- `domain:action` — конкретное действие

Permissions загружаются из GET `/cabinet/auth/me/permissions` при входе.

## Route Guards

```typescript
// Любой авторизованный
<ProtectedRoute>  // проверяет isAuthenticated

// Только admin (isAdmin=true)
<AdminRoute>      // проверяет isAuthenticated + isAdmin

// Admin с конкретным permission
<PermissionRoute permission="tickets:read">
```

## Account Linking & Merge

- Пользователи могут привязывать несколько методов (Telegram + email + OAuth)
- При конфликте (два аккаунта с одним email/Telegram) — процедура merge
- Backend возвращает `merge_token` → /merge/:token → выбор подписки

## OAuth Providers (confirmed from User.auth_type type)
- google
- yandex
- discord
- vk

## Campaign & Referral Tracking
- URL параметры `?campaign=slug` и `?ref=code` захватываются в sessionStorage
- При любом login передаются в запрос
