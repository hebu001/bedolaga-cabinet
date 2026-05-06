# FRONTEND — Bedolaga Cabinet

## Bootstrap Order

```
src/main.tsx:
  1. import './i18n'  — i18next init
  2. HMR guard check (__tg_sdk_initialized)
  3. Telegram SDK: init(), restoreInitData()
  4. clearStaleSessionIfNeeded(initData)
  5. mountMiniApp(), bindThemeParamsCssVars()
  6. mountSwipeBehavior(), disableVerticalSwipes()
  7. mountClosingBehavior(), disableClosingConfirmation()
  8. mountBackButton()
  9. mountViewport() → bindViewportCssVars() → expandViewport() → [fullscreen?]
  10. miniAppReady()
  11. initLogoPreload() (requestIdleCallback)
  12. QueryClient create
  13. ReactDOM.createRoot → StrictMode → ErrorBoundary → QueryClientProvider → AppWithNavigator
```

## Provider Stack

```
BrowserRouter (react-router v7)
  TelegramBackButton (если isInTelegramWebApp)
  ErrorBoundary (page level)
    PlatformProvider        (src/platform/PlatformProvider.tsx)
      ThemeColorsProvider   (src/providers/ThemeColorsProvider.tsx)
        TooltipProvider     (Radix UI)
          ToastProvider     (src/components/Toast)
            WebSocketProvider (src/providers/WebSocketProvider.tsx)
              Twemoji
                App (весь роутер)
```

## Структура src/

```
src/
├── main.tsx             Bootstrap
├── App.tsx              Весь роутер (GOD file, 1173 строки)
├── AppWithNavigator.tsx Provider stack + BrowserRouter
├── i18n.ts              i18next config
├── vite-env.d.ts        VITE_* типы
├── api/                 44 файла — API клиенты по доменам
├── components/          Компоненты (layout, common, auth, blocking, primitives...)
│   ├── layout/          Layout, Navigation
│   ├── common/          PageLoader, ErrorBoundary
│   ├── auth/            PermissionRoute, ProtectedRoute (в App.tsx)
│   └── blocking/        MaintenanceScreen, ChannelSubscriptionScreen...
├── config/              constants.ts (API.TIMEOUT_MS и др.)
├── constants/           Статические константы
├── data/                Статические данные
├── hooks/               15 custom hooks
├── lib/                 Вспомогательные утилиты
├── locales/             Переводы EN/RU
├── pages/               95 страниц
├── platform/            PlatformProvider, определение платформы
├── providers/           WebSocket, ThemeColors
├── store/               4 Zustand stores
├── styles/              globals.css
├── types/               index.ts (715 строк, все типы)
└── utils/               token, campaign, referral, format...
```

## Key Hooks

| Hook | Описание |
|---|---|
| `useTelegramSDK` | isInTelegramWebApp, isTelegramMobile, getCachedFullscreenEnabled |
| `useTheme` | Тема (dark/light) из Telegram или настроек |
| `useFeatureFlags` | Feature flags из backend |
| `useAnalyticsCounters` | Аналитика (вызывается в App.tsx) |
| `useBranding` | Брендинг (лого, название) |
| `useCurrency` | Форматирование валюты |
| `useWebSocket` | WebSocket connection |

## Code Splitting стратегия

- Dashboard → eager (LCP критично)
- Auth pages → eager (маленькие, нужны сразу)
- Все остальные → `lazy()` → отдельный chunk при первом посещении
- Vendor chunks → см. vite.config.ts manualChunks

## Telegram-специфичное поведение

- При открытии в Telegram MiniApp → различные SDK функции активны
- При открытии в браузере → `isInTelegramWebApp()` = false → TelegramBackButton отключён
- ThemeParams CSS variables → автоматически привязываются к :root
- Viewport CSS variables → высота можного окна Telegram
