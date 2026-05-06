# ROUTES AND SCREENS — Bedolaga Cabinet

## Public Routes (без авторизации)

| Path | Component | Описание |
|---|---|---|
| `/login` | Login | Страница входа (Telegram, Email, OAuth) |
| `/auth/telegram/callback` | TelegramCallback | Callback после Telegram Widget |
| `/auth/telegram` | TelegramRedirect | Редирект для Telegram auth |
| `/tg` | TelegramRedirect | Alias |
| `/connect` | DeepLinkRedirect | Deep link для подписки |
| `/add` | DeepLinkRedirect | Alias |
| `/auth/oauth/callback` | OAuthCallback | OAuth callback |
| `/verify-email` | VerifyEmail | Подтверждение email |
| `/reset-password` | ResetPassword | Сброс пароля |
| `/merge/:mergeToken` | MergeAccounts | Слияние аккаунтов |
| `/buy/success/:token` | PurchaseSuccess | Успешная покупка |
| `/buy/:slug` | QuickPurchase | Быстрая покупка по slug |
| `/auto-login` | AutoLogin | Автологин по токену |

## Protected Routes (требуют авторизации)

| Path | Component | Описание |
|---|---|---|
| `/` | Dashboard | Главная, статус подписки |
| `/subscription` | Subscription | Детали подписки |
| `/subscription/purchase` | SubscriptionPurchase | Покупка подписки |
| `/balance` | Balance | Баланс и транзакции |
| `/balance/saved-cards` | SavedCards | Сохранённые карты |
| `/balance/top-up` | TopUpMethodSelect | Выбор метода пополнения |
| `/balance/top-up/:methodId` | TopUpAmount | Сумма пополнения |
| `/balance/top-up/result` | TopUpResult | Результат пополнения |
| `/referral` | Referral | Реферальная программа |
| `/referral/partner/apply` | ReferralPartnerApply | Заявка в партнёры |
| `/referral/withdrawal/request` | ReferralWithdrawalRequest | Запрос выплаты |
| `/support` | Support | Поддержка / тикеты |
| `/profile` | Profile | Профиль пользователя |
| `/profile/accounts` | ConnectedAccounts | Привязанные аккаунты |
| `/auth/link/telegram/callback` | LinkTelegramCallback | Привязка TG |
| `/contests` | Contests | Конкурсы |
| `/polls` | Polls | Опросы |
| `/info` | Info | Информационная страница |
| `/wheel` | Wheel | Колесо удачи |
| `/gift` | GiftSubscription | Подарочная подписка |
| `/gift/result` | GiftResult | Результат подарка |
| `/connection` | Connection | Инструкции по подключению |
| `/connection/qr` | ConnectionQR | QR-код подключения |

## Admin Routes (требуют isAdmin + permissions)

| Path | Permission | Component |
|---|---|---|
| `/admin` | isAdmin | AdminPanel |
| `/admin/dashboard` | stats:read | AdminDashboard |
| `/admin/users` | users:read | AdminUsers |
| `/admin/users/:id` | users:read | AdminUserDetail |
| `/admin/tickets` | tickets:read | AdminTickets |
| `/admin/tickets/settings` | tickets:settings | AdminTicketSettings |
| `/admin/settings` | settings:read | AdminSettings |
| `/admin/apps` | apps:read | AdminApps |
| `/admin/wheel` | wheel:read | AdminWheel |
| `/admin/tariffs` | tariffs:read | AdminTariffs |
| `/admin/tariffs/create` | tariffs:read | AdminTariffCreate |
| `/admin/tariffs/:id/edit` | tariffs:read | AdminTariffCreate |
| `/admin/landings` | landings:read | AdminLandings |
| `/admin/landings/create` | landings:create | AdminLandingEditor |
| `/admin/landings/:id/edit` | landings:edit | AdminLandingEditor |
| `/admin/landings/:id/stats` | landings:read | AdminLandingStats |
| `/admin/servers` | servers:read | AdminServers |
| `/admin/servers/:id/edit` | servers:read | AdminServerEdit |
| `/admin/ban-system` | ban_system:read | AdminBanSystem |
| `/admin/broadcasts` | broadcasts:read | AdminBroadcasts |
| `/admin/broadcasts/create` | broadcasts:read | AdminBroadcastCreate |
| `/admin/broadcasts/:id` | broadcasts:read | AdminBroadcastDetail |
| `/admin/promocodes` | promocodes:read | AdminPromocodes |
| `/admin/promocodes/create` | promocodes:read | AdminPromocodeCreate |
| `/admin/promocodes/:id/edit` | promocodes:read | AdminPromocodeCreate |
| `/admin/promocodes/:id/stats` | promocodes:read | AdminPromocodeStats |
| `/admin/promo-groups` | promo_groups:read | AdminPromoGroups |
| `/admin/promo-groups/create` | promo_groups:read | AdminPromoGroupCreate |
| `/admin/promo-groups/:id/edit` | promo_groups:read | AdminPromoGroupCreate |
| `/admin/campaigns` | campaigns:read | AdminCampaigns |
| `/admin/campaigns/create` | campaigns:read | AdminCampaignCreate |
| `/admin/campaigns/:id/stats` | campaigns:read | AdminCampaignStats |
| `/admin/campaigns/:id/edit` | campaigns:read | AdminCampaignEdit |
| `/admin/partners` | partners:read | AdminPartners |
| `/admin/partners/settings` | partners:read | AdminPartnerSettings |
| `/admin/partners/applications/:id/review` | partners:read | AdminApplicationReview |
| `/admin/partners/:userId` | partners:read | AdminPartnerDetail |
| `/admin/partners/:userId/commission` | partners:read | AdminPartnerCommission |
| `/admin/partners/:userId/revoke` | partners:read | AdminPartnerRevoke |
| `/admin/partners/:userId/campaigns/assign` | partners:read | AdminPartnerCampaignAssign |
| `/admin/withdrawals` | withdrawals:read | AdminWithdrawals |
| `/admin/withdrawals/:id` | withdrawals:read | AdminWithdrawalDetail |
| `/admin/withdrawals/:id/reject` | withdrawals:read | AdminWithdrawalReject |
| `/admin/payments` | payments:read | AdminPayments |
| `/admin/payment-methods` | payment_methods:read | AdminPaymentMethods |
| `/admin/payment-methods/:methodId/edit` | payment_methods:read | AdminPaymentMethodEdit |
| `/admin/promo-offers` | promo_offers:read | AdminPromoOffers |
| `/admin/promo-offers/templates/:id/edit` | promo_offers:read | AdminPromoOfferTemplateEdit |
| `/admin/promo-offers/send` | promo_offers:read | AdminPromoOfferSend |
| `/admin/remnawave` | remnawave:read | AdminRemnawave |
| `/admin/remnawave/squads/:uuid` | remnawave:read | AdminRemnawaveSquadDetail |
| `/admin/email-templates` | email_templates:read | AdminEmailTemplates |
| `/admin/email-templates/preview/:type/:lang` | email_templates:read | AdminEmailTemplatePreview |
| `/admin/updates` | updates:read | AdminUpdates |
| `/admin/pinned-messages` | pinned_messages:read | AdminPinnedMessages |
| `/admin/pinned-messages/create` | pinned_messages:read | AdminPinnedMessageCreate |
| `/admin/pinned-messages/:id/edit` | pinned_messages:read | AdminPinnedMessageCreate |
| `/admin/channel-subscriptions` | channels:read | AdminChannelSubscriptions |
| `/admin/traffic-usage` | traffic:read | AdminTrafficUsage |
| `/admin/sales-stats` | sales_stats:read | AdminSalesStats |
| `/admin/roles` | roles:read | AdminRoles |
| `/admin/roles/create` | roles:create | AdminRoleEdit |
| `/admin/roles/:id/edit` | roles:edit | AdminRoleEdit |
| `/admin/roles/assign` | roles:assign | AdminRoleAssign |
| `/admin/policies` | roles:read | AdminPolicies |
| `/admin/policies/create` | roles:create | AdminPolicyEdit |
| `/admin/policies/:id/edit` | roles:edit | AdminPolicyEdit |
| `/admin/audit-log` | audit_log:read | AdminAuditLog |

## Bottom Navigation Paths (без TG BackButton)
`/` `/subscription` `/balance` `/referral` `/support` `/wheel`

## Catch-all
`/*` → redirect to `/`
