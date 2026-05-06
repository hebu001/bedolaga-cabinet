# SECURITY REVIEW — Bedolaga Cabinet

## Дата аудита: 2026-03-16

## Резюме рисков

| # | Риск | Уровень | Вероятность | Влияние | Статус |
|---|---|---|---|---|---|
| 1 | refreshToken в localStorage | MEDIUM | HIGH | HIGH | Open |
| 2 | Нет CSP заголовков | MEDIUM | HIGH | MEDIUM | Open |
| 3 | Client-side admin check | MEDIUM | LOW | HIGH | Mitigated* |
| 4 | dangerouslySetInnerHTML | LOW | UNKNOWN | HIGH | Unknown |
| 5 | Открытый Caddy admin port | LOW | LOW | MEDIUM | OK |

> *Mitigated — backend должен перепроверять (не подтверждено, backend недоступен)

## Детальный анализ

### 1. refreshToken в localStorage (MEDIUM)
- **Где**: `src/utils/token.ts`, localStorage key `cabinet_refresh_token`
- **Подтверждение**: `src/store/auth.ts:77`, `tokenStorage.setTokens()`
- **Риск**: XSS может украсть refresh token → пожизненный доступ к аккаунту
- **Вероятность**: MEDIUM (DOMPurify используется, но 95 страниц/компонентов)
- **Исправление**: Перенести refreshToken в HttpOnly cookie (требует backend поддержки)

### 2. Нет Content Security Policy (MEDIUM)
- **Где**: Caddyfile (`/opt/caddy/Caddyfile`)
- **Подтверждение**: Просмотр Caddyfile — заголовки не установлены
- **Риск**: XSS без ограничений на загрузку внешних скриптов
- **Исправление**:
```caddyfile
header {
    Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; ..."
    X-Frame-Options "DENY"
    X-Content-Type-Options "nosniff"
    Referrer-Policy "strict-origin-when-cross-origin"
}
```

### 3. Client-side admin check (MEDIUM)
- **Где**: `src/App.tsx:142-162` (AdminRoute), `src/store/auth.ts:116`
- **Подтверждение**: `GET /cabinet/auth/me/is-admin` → client флаг `isAdmin`
- **Риск**: Если backend не проверяет admin на каждом /admin/* endpoint — КРИТИЧНО
- **Вероятность**: LOW (хорошая практика — backend обычно перепроверяет)
- **Статус**: [unknown — backend код недоступен]

### 4. Telegram InitData в sessionStorage (LOW)
- **Где**: `src/api/client.ts:46-51`
- **Риск**: Злоумышленник с XSS может получить Telegram initData для аутентификации
- **Смягчение**: initData имеет expires (Telegram ograничивает время жизни)

### 5. CSRF защита (OK)
- `crypto.getRandomValues` — криптографически стойкий ✅
- Cookie `SameSite=Strict; Secure` ✅
- Header `X-CSRF-Token` на все мутации ✅

### 6. Caddy Admin API порт 2019 (OK)
- Внутри контейнера, не экспонирован в docker-compose.yml ✅

### 7. Stale Session Detection (OK)
- `clearStaleSessionIfNeeded` при инициализации — защита от session fixation ✅

## Рекомендованные действия (приоритет)

1. **[P1]** Добавить security headers в Caddyfile (X-Frame-Options, CSP, X-Content-Type-Options)
2. **[P2]** Аудит всех компонентов на dangerouslySetInnerHTML
3. **[P3]** Рассмотреть HttpOnly cookie для refreshToken (требует backend изменений)
4. **[P3]** Ротация CSRF токена после успешного login
