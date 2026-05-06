# ARCHITECTURE — Bedolaga Cabinet

## Тип системы

**Frontend-only SPA** — React + Vite + TypeScript.
Backend (API) — внешний сервис `https://bed.evovpn.ru`.

## High-level архитектура

```
[User / Admin в браузере]
        ↓ HTTPS
[Caddy reverse proxy — miniapp.evovpn.ru]
    /api/* → https://bed.evovpn.ru (external Telegram Bot Backend)
    /*     → /srv/cabinet (static SPA files)
        ↓
[React SPA]
    L TanStack Query (server state cache)
    L axios (apiClient) → /api/* → Caddy → Backend
    L Zustand (client state)
    L react-router (SPA routing)
```

## Слои приложения

```
1. Infrastructure Layer
   main.tsx — bootstrap, Telegram SDK init, React render
   vite.config.ts — build, code splitting, dev proxy

2. Application Layer (AppWithNavigator.tsx)
   BrowserRouter → все провайдеры (Platform, Theme, Toast, WebSocket, Twemoji)
   TelegramBackButton — управление кнопкой "назад"

3. Routing Layer (App.tsx — GOD file)
   ProtectedRoute, AdminRoute, PermissionRoute
   95 маршрутов, определение видимости UI

4. Page Layer (src/pages/)
   95 страниц — user + admin
   Логика страницы + локальный state + TanStack Query

5. Component Layer (src/components/)
   Переиспользуемые компоненты, layout, UI primitives

6. State Layer (src/store/)
   useAuthStore — auth state (Zustand+persist)
   usePermissionStore — RBAC
   useBlockingStore — глобальные блокировки
   useSuccessNotificationStore

7. API Layer (src/api/)
   client.ts — axios instance с interceptors
   44 файла — по одному на API домен

8. Domain Layer (src/types/index.ts)
   Все TypeScript типы в одном файле (715 строк)

9. Infrastructure Config
   Caddy (/opt/caddy/) — reverse proxy, TLS
   Docker (Dockerfile, docker-compose.yml)
```

## Модули и связи

```
main.tsx → AppWithNavigator → App
App.tsx использует:
  - useAuthStore (для ProtectedRoute/AdminRoute)
  - useBlockingStore (для BlockingOverlay)
  - 95 lazy-imported страниц

store/auth.ts использует:
  - api/auth.ts (login, logout, getMe)
  - api/client.ts (для checkAdminStatus)
  - store/permissions.ts (для fetchPermissions после admin check)
  - utils/token.ts

api/client.ts использует:
  - config/constants.ts (API.TIMEOUT_MS)
  - store/blocking.ts (setMaintenance, setChannelSubscription...)
  - utils/token.ts

Каждая страница (Subscription, Balance, etc.) использует:
  - api/subscription.ts (или соответствующий домен)
  - TanStack Query (useQuery/useMutation)
  - Zustand stores если нужно
```

## Single Points of Failure

1. **App.tsx** — любая синтаксическая ошибка = белый экран у всех
2. **api/client.ts** — ошибка в interceptors = все запросы не работают
3. **store/auth.ts** — ошибка = нет авторизации нигде
4. **Caddy** — падение = сайт недоступен (нет redundancy)
5. **https://bed.evovpn.ru** — недоступен = все API вызовы падают

## Производительность (Bundle)

- Вендорные chunks разделены (React, Query, i18n, Motion, Radix, DnD, Telegram, Crypto)
- Dashboard загружается eagerly
- Остальные страницы — lazy (95 chunks)
- chunkSizeWarningLimit: 550KB (поднят выше стандарта 500)

## WebSocket

- `WebSocketProvider` в provider stack
- Endpoint и протокол — [unknown]
- Предположительно: real-time уведомления о тикетах и платежах
