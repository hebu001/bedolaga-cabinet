# SYSTEM CONTEXT — Bedolaga Cabinet

## Место в экосистеме

```
[Telegram Bot @evo_bedol_bot]
        ↓ (отправляет пользователей в WebApp / кабинет)
[Bedolaga Cabinet — miniapp.evovpn.ru]
        ↓ API запросы
[Backend Bot — bed.evovpn.ru:Cabinet API]
        ↓
[База данных — unknown]

[Caddy] — обеспечивает TLS + proxy между компонентами
```

## Внешние интеграции

| Интеграция | Тип | Обязательна | Описание |
|---|---|---|---|
| Telegram Bot API | WebApp SDK | ✅ | Auth, BackButton, theme, fullscreen |
| bed.evovpn.ru | REST API | ✅ | Весь backend |
| Let's Encrypt | ACME | ✅ | TLS сертификат через Caddy |
| OAuth providers | OAuth2 | — | Google, Yandex, Discord, VK |
| Remnawave | Integration | — | VPN серверные группы (squads) |
| Payment providers | — | — | [unknown — конфигурируется в backend] |

## Зависимости системы

**Обязательные для работы:**
1. `https://bed.evovpn.ru` доступен с сервера
2. DNS `miniapp.evovpn.ru` → IP `185.211.170.158`
3. Порты 80/443 открыты (для Let's Encrypt challenge)
4. Docker daemon запущен
5. `CABINET_ENABLED=true` в .env бота
6. `CABINET_ALLOWED_ORIGINS=https://miniapp.evovpn.ru` в .env бота

**Обязательные для разработки:**
1. Node.js 20+, npm (локально)
2. Docker (для сборки если npm не установлен)
3. Доступ к Github репозиторию

## Жизненный цикл запроса

```
Пользователь в Telegram MiniApp
  → нажимает кнопку
  → React component → TanStack Query → apiClient
  → axios request POST /api/cabinet/subscription/purchase
  → Caddy: strip /api → https://bed.evovpn.ru/cabinet/subscription/purchase
  → Backend bot обрабатывает
  → ответ JSON → axios → TanStack Query cache → React re-render
```
