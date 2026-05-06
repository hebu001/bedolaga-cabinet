# STACK — Bedolaga Cabinet

## Frontend Stack

| Категория | Технология | Версия | Статус |
|---|---|---|---|
| Language | TypeScript | ^5.2.2 | confirmed |
| Framework | React | ^19.2.4 | confirmed |
| Build tool | Vite | ^7.3.1 | confirmed |
| Package manager | npm | (lockfile v3) | confirmed |
| Router | react-router v7 | ^7.13.0 | confirmed |
| State management | Zustand | ^5.0.11 | confirmed |
| Server state | TanStack Query | ^5.8.0 | confirmed |
| HTTP client | Axios | ^1.6.0 | confirmed |
| UI primitives | Radix UI | ^1.x-2.x | confirmed |
| Styling | TailwindCSS v3 | ^3.4.19 | confirmed |
| CSS variants | class-variance-authority | ^0.7.1 | confirmed |
| Animations | Framer Motion | ^12.29.2 | confirmed |
| i18n | i18next + react-i18next | ^25 / ^16 | confirmed |
| Tables | TanStack Table | ^8.21.3 | confirmed |
| DnD | @dnd-kit | ^6-10 | confirmed |
| Charts | Recharts | ^3.7.0 | confirmed |
| QR codes | qrcode.react | ^4.2.0 | confirmed |
| Emoji | react-twemoji | ^0.7.2 | confirmed |
| Sanitization | DOMPurify | ^3.3.1 | confirmed |
| Crypto | jsencrypt, @kastov/cryptohapp | — | confirmed |
| Noise | simplex-noise | ^4.0.3 | confirmed |

## Telegram Integration

| Компонент | Версия | Статус |
|---|---|---|
| @telegram-apps/sdk-react | ^3.3.9 | confirmed |

## DevOps Stack

| Категория | Технология | Статус |
|---|---|---|
| Containerization | Docker (multi-stage) | confirmed |
| Reverse proxy | Caddy v2 | confirmed |
| Web server (internal) | nginx:alpine | confirmed |
| Node runtime (build) | node:20-alpine | confirmed |
| OS | Linux (production server) | confirmed |

## Backend Stack (external, недоступен)

| Категория | Технология | Статус |
|---|---|---|
| Runtime | Python [assumption] | assumption |
| Framework | FastAPI [assumption] | assumption (error format) |
| Database | [unknown] | unknown |
| Auth | JWT | confirmed (from types) |

## CI/CD

- Нет CI/CD конфигурации в репозитории (нет .github/workflows/, .gitlab-ci.yml и т.д.)
- Обновление — вручную через git pull + docker build
