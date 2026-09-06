import { Fragment, lazy, Suspense, type ComponentType } from 'react';
import { Routes, Route, Navigate, useLocation, useParams } from 'react-router';
import { useAuthStore } from './store/auth';
import { AdminTranslationsGate } from './providers/I18nBootstrap';

/**
 * Wrapper around React.lazy that auto-reloads the page when a chunk fails to load
 * (e.g. after a new deploy with different chunk hashes).
 */
function lazyWithRetry<T extends ComponentType<unknown>>(factory: () => Promise<{ default: T }>) {
  return lazy(() =>
    factory().catch(() => {
      const key = 'chunk_reload_ts';
      const last = Number(sessionStorage.getItem(key) || '0');
      if (Date.now() - last > 30_000) {
        sessionStorage.setItem(key, String(Date.now()));
        window.location.reload();
      }
      // Re-throw so ErrorBoundary catches it if reload guard prevents loop
      return factory();
    }),
  );
}
import { useBlockingStore } from './store/blocking';
import Layout from './components/layout/Layout';
import PageLoader from './components/common/PageLoader';
import {
  MaintenanceScreen,
  ChannelSubscriptionScreen,
  BlacklistedScreen,
  AccountDeletedScreen,
} from './components/blocking';
import { ErrorBoundary } from './components/ErrorBoundary';
import { PermissionRoute } from '@/components/auth/PermissionRoute';
import { saveReturnUrl } from './utils/token';
import { useAnalyticsCounters } from './hooks/useAnalyticsCounters';
import { useSiteVerification } from './hooks/useSiteVerification';
// Load only the route being opened; callback instances keep their existing keys.
const Login = lazyWithRetry(() => import('./pages/Login'));
const TelegramCallback = lazyWithRetry(() => import('./pages/TelegramCallback'));
const TelegramRedirect = lazyWithRetry(() => import('./pages/TelegramRedirect'));
const DeepLinkRedirect = lazyWithRetry(() => import('./pages/DeepLinkRedirect'));
const VerifyEmail = lazyWithRetry(() => import('./pages/VerifyEmail'));
const ResetPassword = lazyWithRetry(() => import('./pages/ResetPassword'));
const OAuthCallback = lazyWithRetry(() => import('./pages/OAuthCallback'));
const Dashboard = lazyWithRetry(() => import('./pages/Dashboard'));

function lazyAdmin(factory: () => Promise<{ default: ComponentType<unknown> }>) {
  const Page = lazyWithRetry(factory);
  return function AdminPage() {
    return (
      <AdminTranslationsGate>
        <Page />
      </AdminTranslationsGate>
    );
  };
}

// User pages - lazy load
const Subscriptions = lazyWithRetry(() => import('./pages/Subscriptions'));
const Subscription = lazyWithRetry(() => import('./pages/Subscription'));
const SubscriptionPurchase = lazyWithRetry(() => import('./pages/SubscriptionPurchase'));
const Balance = lazyWithRetry(() => import('./pages/Balance'));
const SavedCards = lazyWithRetry(() => import('./pages/SavedCards'));
const Support = lazyWithRetry(() => import('./pages/Support'));
const Profile = lazyWithRetry(() => import('./pages/Profile'));
const Contests = lazyWithRetry(() => import('./pages/Contests'));
const Polls = lazyWithRetry(() => import('./pages/Polls'));
const Info = lazyWithRetry(() => import('./pages/Info'));
const Wheel = lazyWithRetry(() => import('./pages/Wheel'));
const GiftSubscription = lazyWithRetry(() => import('./pages/GiftSubscription'));
const GiftResult = lazyWithRetry(() => import('./pages/GiftResult'));
const Connection = lazyWithRetry(() => import('./pages/Connection'));
const ConnectionQR = lazyWithRetry(() => import('./pages/ConnectionQR'));
const QuickPurchase = lazyWithRetry(() => import('./pages/QuickPurchase'));
const PurchaseSuccess = lazyWithRetry(() => import('./pages/PurchaseSuccess'));
const RenewSubscription = lazyWithRetry(() => import('./pages/RenewSubscription'));
const AutoLogin = lazyWithRetry(() => import('./pages/AutoLogin'));
const TopUpResult = lazyWithRetry(() => import('./pages/TopUpResult'));
const ConnectedAccounts = lazyWithRetry(() => import('./pages/ConnectedAccounts'));
const LinkTelegramCallback = lazyWithRetry(() => import('./pages/LinkTelegramCallback'));
const MergeAccounts = lazyWithRetry(() => import('./pages/MergeAccounts'));

// Design previews — public, no auth, mobile mockups
const PreviewIndex = lazyWithRetry(() => import('./pages/preview/PreviewIndex'));
const StripeBalance = lazyWithRetry(() => import('./pages/preview/StripeBalance'));
const StripeSubscription = lazyWithRetry(() => import('./pages/preview/StripeSubscription'));
const RevolutBalance = lazyWithRetry(() => import('./pages/preview/RevolutBalance'));
const RevolutSubscription = lazyWithRetry(() => import('./pages/preview/RevolutSubscription'));
const LinearBalance = lazyWithRetry(() => import('./pages/preview/LinearBalance'));
const LinearSubscription = lazyWithRetry(() => import('./pages/preview/LinearSubscription'));
const SupabaseBalance = lazyWithRetry(() => import('./pages/preview/SupabaseBalance'));
const SupabaseSubscription = lazyWithRetry(() => import('./pages/preview/SupabaseSubscription'));
const LamborghiniBalance = lazyWithRetry(() => import('./pages/preview/LamborghiniBalance'));
const LamborghiniSubscription = lazyWithRetry(
  () => import('./pages/preview/LamborghiniSubscription'),
);
const BugattiBalance = lazyWithRetry(() => import('./pages/preview/BugattiBalance'));
const BugattiSubscription = lazyWithRetry(() => import('./pages/preview/BugattiSubscription'));
const BinanceBalance = lazyWithRetry(() => import('./pages/preview/BinanceBalance'));
const BinanceSubscription = lazyWithRetry(() => import('./pages/preview/BinanceSubscription'));
const AppleBalance = lazyWithRetry(() => import('./pages/preview/AppleBalance'));
const AppleSubscription = lazyWithRetry(() => import('./pages/preview/AppleSubscription'));

// Admin pages - lazy load (only for admins)
const AdminPanel = lazyAdmin(() => import('./pages/AdminPanel'));
const AdminTickets = lazyAdmin(() => import('./pages/AdminTickets'));
const AdminTicketSettings = lazyAdmin(() => import('./pages/AdminTicketSettings'));
const AdminSettings = lazyAdmin(() => import('./pages/AdminSettings'));
const AdminApps = lazyAdmin(() => import('./pages/AdminApps'));
const AdminWheel = lazyAdmin(() => import('./pages/AdminWheel'));
const AdminTariffs = lazyAdmin(() => import('./pages/AdminTariffs'));
const AdminTariffCreate = lazyAdmin(() => import('./pages/AdminTariffCreate'));
const AdminServers = lazyAdmin(() => import('./pages/AdminServers'));
const AdminServerEdit = lazyAdmin(() => import('./pages/AdminServerEdit'));
const AdminDashboard = lazyAdmin(() => import('./pages/AdminDashboard'));
const AdminBanSystem = lazyAdmin(() => import('./pages/AdminBanSystem'));
const AdminBroadcasts = lazyAdmin(() => import('./pages/AdminBroadcasts'));
const AdminBroadcastCreate = lazyAdmin(() => import('./pages/AdminBroadcastCreate'));
const AdminPromocodes = lazyAdmin(() => import('./pages/AdminPromocodes'));
const AdminPromocodeCreate = lazyAdmin(() => import('./pages/AdminPromocodeCreate'));
const AdminPromocodeStats = lazyAdmin(() => import('./pages/AdminPromocodeStats'));
const AdminPromoGroups = lazyAdmin(() => import('./pages/AdminPromoGroups'));
const AdminPromoGroupCreate = lazyAdmin(() => import('./pages/AdminPromoGroupCreate'));
const AdminCampaigns = lazyAdmin(() => import('./pages/AdminCampaigns'));
const AdminCampaignCreate = lazyAdmin(() => import('./pages/AdminCampaignCreate'));
const AdminCampaignStats = lazyAdmin(() => import('./pages/AdminCampaignStats'));
const AdminCampaignEdit = lazyAdmin(() => import('./pages/AdminCampaignEdit'));
const AdminPartners = lazyAdmin(() => import('./pages/AdminPartners'));
const AdminPartnerSettings = lazyAdmin(() => import('./pages/AdminPartnerSettings'));
const AdminPartnerDetail = lazyAdmin(() => import('./pages/AdminPartnerDetail'));
const AdminApplicationReview = lazyAdmin(() => import('./pages/AdminApplicationReview'));
const AdminPartnerCommission = lazyAdmin(() => import('./pages/AdminPartnerCommission'));
const AdminPartnerRevoke = lazyAdmin(() => import('./pages/AdminPartnerRevoke'));
const AdminPartnerCampaignAssign = lazyAdmin(() => import('./pages/AdminPartnerCampaignAssign'));
const AdminWithdrawals = lazyAdmin(() => import('./pages/AdminWithdrawals'));
const AdminWithdrawalDetail = lazyAdmin(() => import('./pages/AdminWithdrawalDetail'));
const AdminWithdrawalReject = lazyAdmin(() => import('./pages/AdminWithdrawalReject'));
const ReferralPartnerApply = lazyWithRetry(() => import('./pages/ReferralPartnerApply'));
const ReferralWithdrawalRequest = lazyWithRetry(() => import('./pages/ReferralWithdrawalRequest'));
const AdminUsers = lazyAdmin(() => import('./pages/AdminUsers'));
const AdminPayments = lazyAdmin(() => import('./pages/AdminPayments'));
const AdminPaymentMethods = lazyAdmin(() => import('./pages/AdminPaymentMethods'));
const AdminPaymentMethodEdit = lazyAdmin(() => import('./pages/AdminPaymentMethodEdit'));
const AdminPromoOffers = lazyAdmin(() => import('./pages/AdminPromoOffers'));
const AdminPromoOfferTemplateEdit = lazyAdmin(() => import('./pages/AdminPromoOfferTemplateEdit'));
const AdminPromoOfferSend = lazyAdmin(() => import('./pages/AdminPromoOfferSend'));
const AdminRemnawave = lazyAdmin(() => import('./pages/AdminRemnawave'));
const AdminRemnawaveSquadDetail = lazyAdmin(() => import('./pages/AdminRemnawaveSquadDetail'));
const AdminEmailTemplates = lazyAdmin(() => import('./pages/AdminEmailTemplates'));
const AdminTrafficUsage = lazyAdmin(() => import('./pages/AdminTrafficUsage'));
const AdminBulkActions = lazyAdmin(() => import('./pages/AdminBulkActions'));
const AdminSalesStats = lazyAdmin(() => import('./pages/AdminSalesStats'));
const AdminUpdates = lazyAdmin(() => import('./pages/AdminUpdates'));
const AdminUserDetail = lazyAdmin(() => import('./pages/AdminUserDetail'));
const AdminBroadcastDetail = lazyAdmin(() => import('./pages/AdminBroadcastDetail'));
const AdminPinnedMessages = lazyAdmin(() => import('./pages/AdminPinnedMessages'));
const AdminPinnedMessageCreate = lazyAdmin(() => import('./pages/AdminPinnedMessageCreate'));
const AdminChannelSubscriptions = lazyAdmin(() => import('./pages/AdminChannelSubscriptions'));
const AdminEmailTemplatePreview = lazyAdmin(() => import('./pages/AdminEmailTemplatePreview'));
const AdminRoles = lazyAdmin(() => import('./pages/AdminRoles'));
const AdminRoleEdit = lazyAdmin(() => import('./pages/AdminRoleEdit'));
const AdminRoleAssign = lazyAdmin(() => import('./pages/AdminRoleAssign'));
const AdminPolicies = lazyAdmin(() => import('./pages/AdminPolicies'));
const AdminPolicyEdit = lazyAdmin(() => import('./pages/AdminPolicyEdit'));
const AdminAuditLog = lazyAdmin(() => import('./pages/AdminAuditLog'));
const AdminLandings = lazyAdmin(() => import('./pages/AdminLandings'));
const AdminLandingEditor = lazyAdmin(() => import('./pages/AdminLandingEditor'));
const AdminLandingStats = lazyAdmin(() => import('./pages/AdminLandingStats'));
const AdminReferralNetwork = lazyAdmin(() => import('./pages/ReferralNetwork'));

// News pages
const NewsArticlePage = lazyWithRetry(() => import('./pages/NewsArticle'));
const AdminNews = lazyAdmin(() => import('./pages/AdminNews'));
const AdminNewsCreate = lazyAdmin(() => import('./pages/AdminNewsCreate'));

// Info pages
const InfoPageView = lazyWithRetry(() => import('./pages/InfoPageView'));
const AdminInfoPages = lazyAdmin(() => import('./pages/AdminInfoPages'));
const AdminInfoPageEditor = lazyAdmin(() => import('./pages/AdminInfoPageEditor'));

function ProtectedRoute({
  children,
  withLayout = true,
}: {
  children: React.ReactNode;
  withLayout?: boolean;
}) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const sessionGeneration = useAuthStore((state) => state.sessionGeneration);
  const isLoading = useAuthStore((state) => state.isLoading);
  const location = useLocation();

  if (isLoading) {
    return <PageLoader variant="dark" />;
  }

  if (!isAuthenticated) {
    saveReturnUrl();
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return withLayout ? (
    <Layout key={sessionGeneration}>{children}</Layout>
  ) : (
    <Fragment key={sessionGeneration}>{children}</Fragment>
  );
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const sessionGeneration = useAuthStore((state) => state.sessionGeneration);
  const isLoading = useAuthStore((state) => state.isLoading);
  const isAdmin = useAuthStore((state) => state.isAdmin);
  const location = useLocation();

  if (isLoading) {
    return <PageLoader variant="light" />;
  }

  if (!isAuthenticated) {
    saveReturnUrl();
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <Layout key={sessionGeneration}>{children}</Layout>;
}

// Suspense wrapper for lazy components
function LazyPage({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<PageLoader variant="dark" />}>{children}</Suspense>;
}

function BlockingOverlay() {
  const blockingType = useBlockingStore((state) => state.blockingType);

  if (blockingType === 'maintenance') {
    return <MaintenanceScreen />;
  }

  if (blockingType === 'channel_subscription') {
    return <ChannelSubscriptionScreen />;
  }

  if (blockingType === 'blacklisted') {
    return <BlacklistedScreen />;
  }

  if (blockingType === 'account_deleted') {
    return <AccountDeletedScreen />;
  }

  return null;
}

/** Redirect /subscription/:id → /subscriptions/:id preserving the param */
function LegacySubscriptionRedirect() {
  const { subscriptionId } = useParams<{ subscriptionId: string }>();
  return <Navigate to={`/subscriptions/${subscriptionId}`} replace />;
}

function LegacyTopUpRedirect() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  params.set('topup', '1');
  return <Navigate to={{ pathname: '/balance', search: `?${params}` }} replace />;
}

function AppSessionEffects() {
  useAnalyticsCounters();
  // Pulls site-verification tokens (Antilopay apay-tag etc.) from the bot
  // backend and injects matching <meta> tags into document.head.
  useSiteVerification();
  return null;
}

function App() {
  const sessionGeneration = useAuthStore((state) => state.sessionGeneration);
  return (
    <>
      <AppSessionEffects key={sessionGeneration} />
      <BlockingOverlay />
      <Routes>
        {/* Public routes */}
        <Route
          path="/login"
          element={
            <LazyPage>
              <Login key={sessionGeneration} />
            </LazyPage>
          }
        />
        <Route
          path="/auth/telegram/callback"
          element={
            <LazyPage>
              <TelegramCallback />
            </LazyPage>
          }
        />
        <Route
          path="/auth/telegram"
          element={
            <LazyPage>
              <TelegramRedirect key={sessionGeneration} />
            </LazyPage>
          }
        />
        <Route
          path="/tg"
          element={
            <LazyPage>
              <TelegramRedirect key={sessionGeneration} />
            </LazyPage>
          }
        />
        <Route
          path="/connect"
          element={
            <LazyPage>
              <DeepLinkRedirect />
            </LazyPage>
          }
        />
        <Route
          path="/add"
          element={
            <LazyPage>
              <DeepLinkRedirect />
            </LazyPage>
          }
        />
        <Route
          path="/auth/oauth/callback"
          element={
            <LazyPage>
              <OAuthCallback />
            </LazyPage>
          }
        />
        <Route
          path="/verify-email"
          element={
            <LazyPage>
              <VerifyEmail />
            </LazyPage>
          }
        />
        <Route
          path="/reset-password"
          element={
            <LazyPage>
              <ResetPassword />
            </LazyPage>
          }
        />
        <Route
          path="/merge/:mergeToken"
          element={
            <LazyPage>
              <MergeAccounts key={sessionGeneration} />
            </LazyPage>
          }
        />
        <Route
          path="/buy/success/:token"
          element={
            <ErrorBoundary level="app">
              <LazyPage>
                <PurchaseSuccess key={sessionGeneration} />
              </LazyPage>
            </ErrorBoundary>
          }
        />
        <Route
          path="/buy/:slug"
          element={
            <ErrorBoundary level="app">
              <LazyPage>
                <QuickPurchase key={sessionGeneration} />
              </LazyPage>
            </ErrorBoundary>
          }
        />
        <Route
          path="/auto-login"
          element={
            <ErrorBoundary level="app">
              <LazyPage>
                <AutoLogin />
              </LazyPage>
            </ErrorBoundary>
          }
        />

        {/* Design previews — public, no auth, mobile mockups */}
        <Route
          path="/preview"
          element={
            <LazyPage>
              <PreviewIndex />
            </LazyPage>
          }
        />
        <Route
          path="/preview/stripe/balance"
          element={
            <LazyPage>
              <StripeBalance />
            </LazyPage>
          }
        />
        <Route
          path="/preview/stripe/subscription"
          element={
            <LazyPage>
              <StripeSubscription />
            </LazyPage>
          }
        />
        <Route
          path="/preview/revolut/balance"
          element={
            <LazyPage>
              <RevolutBalance />
            </LazyPage>
          }
        />
        <Route
          path="/preview/revolut/subscription"
          element={
            <LazyPage>
              <RevolutSubscription />
            </LazyPage>
          }
        />
        <Route
          path="/preview/linear/balance"
          element={
            <LazyPage>
              <LinearBalance />
            </LazyPage>
          }
        />
        <Route
          path="/preview/linear/subscription"
          element={
            <LazyPage>
              <LinearSubscription />
            </LazyPage>
          }
        />
        <Route
          path="/preview/supabase/balance"
          element={
            <LazyPage>
              <SupabaseBalance />
            </LazyPage>
          }
        />
        <Route
          path="/preview/supabase/subscription"
          element={
            <LazyPage>
              <SupabaseSubscription />
            </LazyPage>
          }
        />
        <Route
          path="/preview/lamborghini/balance"
          element={
            <LazyPage>
              <LamborghiniBalance />
            </LazyPage>
          }
        />
        <Route
          path="/preview/lamborghini/subscription"
          element={
            <LazyPage>
              <LamborghiniSubscription />
            </LazyPage>
          }
        />
        <Route
          path="/preview/bugatti/balance"
          element={
            <LazyPage>
              <BugattiBalance />
            </LazyPage>
          }
        />
        <Route
          path="/preview/bugatti/subscription"
          element={
            <LazyPage>
              <BugattiSubscription />
            </LazyPage>
          }
        />
        <Route
          path="/preview/binance/balance"
          element={
            <LazyPage>
              <BinanceBalance />
            </LazyPage>
          }
        />
        <Route
          path="/preview/binance/subscription"
          element={
            <LazyPage>
              <BinanceSubscription />
            </LazyPage>
          }
        />
        <Route
          path="/preview/apple/balance"
          element={
            <LazyPage>
              <AppleBalance />
            </LazyPage>
          }
        />
        <Route
          path="/preview/apple/subscription"
          element={
            <LazyPage>
              <AppleSubscription />
            </LazyPage>
          }
        />

        {/* Protected routes */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <LazyPage>
                <Dashboard />
              </LazyPage>
            </ProtectedRoute>
          }
        />
        <Route
          path="/subscriptions"
          element={
            <ProtectedRoute>
              <LazyPage>
                <Subscriptions />
              </LazyPage>
            </ProtectedRoute>
          }
        />
        <Route
          path="/subscriptions/:subscriptionId"
          element={
            <ProtectedRoute>
              <LazyPage>
                <Subscription />
              </LazyPage>
            </ProtectedRoute>
          }
        />
        <Route
          path="/subscriptions/:subscriptionId/renew"
          element={
            <ProtectedRoute>
              <LazyPage>
                <RenewSubscription />
              </LazyPage>
            </ProtectedRoute>
          }
        />
        {/* Legacy redirects for backward compatibility */}
        <Route path="/subscription/:subscriptionId" element={<LegacySubscriptionRedirect />} />
        <Route
          path="/subscription"
          element={
            <ProtectedRoute>
              <Navigate to="/subscriptions" replace />
            </ProtectedRoute>
          }
        />
        <Route
          path="/subscription/purchase"
          element={
            <ProtectedRoute>
              <LazyPage>
                <SubscriptionPurchase />
              </LazyPage>
            </ProtectedRoute>
          }
        />
        <Route
          path="/balance"
          element={
            <ProtectedRoute>
              <LazyPage>
                <Balance />
              </LazyPage>
            </ProtectedRoute>
          }
        />
        <Route
          path="/balance/saved-cards"
          element={
            <ProtectedRoute>
              <LazyPage>
                <SavedCards />
              </LazyPage>
            </ProtectedRoute>
          }
        />
        {/* Top-up flow folded into /balance — legacy routes redirect */}
        <Route path="/balance/top-up" element={<LegacyTopUpRedirect />} />
        <Route
          path="/balance/top-up/result"
          element={
            <ProtectedRoute withLayout={false}>
              <ErrorBoundary level="app">
                <LazyPage>
                  <TopUpResult />
                </LazyPage>
              </ErrorBoundary>
            </ProtectedRoute>
          }
        />
        <Route path="/balance/top-up/:methodId" element={<LegacyTopUpRedirect />} />
        <Route
          path="/referral"
          element={
            <ProtectedRoute>
              <LazyPage>
                <Profile />
              </LazyPage>
            </ProtectedRoute>
          }
        />
        <Route
          path="/referral/partner/apply"
          element={
            <ProtectedRoute>
              <LazyPage>
                <ReferralPartnerApply />
              </LazyPage>
            </ProtectedRoute>
          }
        />
        <Route
          path="/referral/withdrawal/request"
          element={
            <ProtectedRoute>
              <LazyPage>
                <ReferralWithdrawalRequest />
              </LazyPage>
            </ProtectedRoute>
          }
        />
        <Route
          path="/support"
          element={
            <ProtectedRoute>
              <LazyPage>
                <Support />
              </LazyPage>
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <LazyPage>
                <Profile />
              </LazyPage>
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile/accounts"
          element={
            <ProtectedRoute>
              <LazyPage>
                <ConnectedAccounts />
              </LazyPage>
            </ProtectedRoute>
          }
        />
        <Route
          path="/auth/link/telegram/callback"
          element={
            <ProtectedRoute>
              <LazyPage>
                <LinkTelegramCallback />
              </LazyPage>
            </ProtectedRoute>
          }
        />
        <Route
          path="/contests"
          element={
            <ProtectedRoute>
              <LazyPage>
                <Contests />
              </LazyPage>
            </ProtectedRoute>
          }
        />
        <Route
          path="/polls"
          element={
            <ProtectedRoute>
              <LazyPage>
                <Polls />
              </LazyPage>
            </ProtectedRoute>
          }
        />
        <Route
          path="/info"
          element={
            <ProtectedRoute>
              <LazyPage>
                <Info />
              </LazyPage>
            </ProtectedRoute>
          }
        />
        <Route
          path="/wheel"
          element={
            <ProtectedRoute>
              <LazyPage>
                <Wheel />
              </LazyPage>
            </ProtectedRoute>
          }
        />
        <Route
          path="/gift"
          element={
            <ErrorBoundary level="app">
              <ProtectedRoute>
                <LazyPage>
                  <GiftSubscription />
                </LazyPage>
              </ProtectedRoute>
            </ErrorBoundary>
          }
        />
        <Route
          path="/gift/result"
          element={
            <ErrorBoundary level="app">
              <ProtectedRoute>
                <LazyPage>
                  <GiftResult />
                </LazyPage>
              </ProtectedRoute>
            </ErrorBoundary>
          }
        />
        <Route
          path="/connection/qr"
          element={
            <ProtectedRoute>
              <LazyPage>
                <ConnectionQR />
              </LazyPage>
            </ProtectedRoute>
          }
        />
        <Route
          path="/connection"
          element={
            <ProtectedRoute>
              <LazyPage>
                <Connection />
              </LazyPage>
            </ProtectedRoute>
          }
        />
        <Route
          path="/news/:slug"
          element={
            <ProtectedRoute>
              <LazyPage>
                <NewsArticlePage />
              </LazyPage>
            </ProtectedRoute>
          }
        />
        <Route
          path="/info/:slug"
          element={
            <ProtectedRoute>
              <LazyPage>
                <InfoPageView />
              </LazyPage>
            </ProtectedRoute>
          }
        />

        {/* Admin routes */}
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <LazyPage>
                <AdminPanel />
              </LazyPage>
            </AdminRoute>
          }
        />
        <Route
          path="/admin/tickets"
          element={
            <PermissionRoute permission="tickets:read">
              <LazyPage>
                <AdminTickets />
              </LazyPage>
            </PermissionRoute>
          }
        />
        <Route
          path="/admin/tickets/settings"
          element={
            <PermissionRoute permission="tickets:settings">
              <LazyPage>
                <AdminTicketSettings />
              </LazyPage>
            </PermissionRoute>
          }
        />
        <Route
          path="/admin/settings"
          element={
            <PermissionRoute permission="settings:read">
              <LazyPage>
                <AdminSettings />
              </LazyPage>
            </PermissionRoute>
          }
        />
        <Route
          path="/admin/apps"
          element={
            <PermissionRoute permission="apps:read">
              <LazyPage>
                <AdminApps />
              </LazyPage>
            </PermissionRoute>
          }
        />
        <Route
          path="/admin/wheel"
          element={
            <PermissionRoute permission="wheel:read">
              <LazyPage>
                <AdminWheel />
              </LazyPage>
            </PermissionRoute>
          }
        />
        <Route
          path="/admin/tariffs"
          element={
            <PermissionRoute permission="tariffs:read">
              <LazyPage>
                <AdminTariffs />
              </LazyPage>
            </PermissionRoute>
          }
        />
        <Route
          path="/admin/tariffs/create"
          element={
            <PermissionRoute permission="tariffs:read">
              <LazyPage>
                <AdminTariffCreate />
              </LazyPage>
            </PermissionRoute>
          }
        />
        <Route
          path="/admin/tariffs/:id/edit"
          element={
            <PermissionRoute permission="tariffs:read">
              <LazyPage>
                <AdminTariffCreate />
              </LazyPage>
            </PermissionRoute>
          }
        />
        <Route
          path="/admin/landings"
          element={
            <PermissionRoute permission="landings:read">
              <LazyPage>
                <AdminLandings />
              </LazyPage>
            </PermissionRoute>
          }
        />
        <Route
          path="/admin/landings/create"
          element={
            <PermissionRoute permission="landings:create">
              <LazyPage>
                <AdminLandingEditor />
              </LazyPage>
            </PermissionRoute>
          }
        />
        <Route
          path="/admin/landings/:id/edit"
          element={
            <PermissionRoute permission="landings:edit">
              <LazyPage>
                <AdminLandingEditor />
              </LazyPage>
            </PermissionRoute>
          }
        />
        <Route
          path="/admin/landings/:id/stats"
          element={
            <PermissionRoute permission="landings:read">
              <LazyPage>
                <AdminLandingStats />
              </LazyPage>
            </PermissionRoute>
          }
        />
        <Route
          path="/admin/servers"
          element={
            <PermissionRoute permission="servers:read">
              <LazyPage>
                <AdminServers />
              </LazyPage>
            </PermissionRoute>
          }
        />
        <Route
          path="/admin/servers/:id/edit"
          element={
            <PermissionRoute permission="servers:read">
              <LazyPage>
                <AdminServerEdit />
              </LazyPage>
            </PermissionRoute>
          }
        />
        <Route
          path="/admin/dashboard"
          element={
            <PermissionRoute permission="stats:read">
              <LazyPage>
                <AdminDashboard />
              </LazyPage>
            </PermissionRoute>
          }
        />
        <Route
          path="/admin/ban-system"
          element={
            <PermissionRoute permission="ban_system:read">
              <LazyPage>
                <AdminBanSystem />
              </LazyPage>
            </PermissionRoute>
          }
        />
        <Route
          path="/admin/broadcasts"
          element={
            <PermissionRoute permission="broadcasts:read">
              <LazyPage>
                <AdminBroadcasts />
              </LazyPage>
            </PermissionRoute>
          }
        />
        <Route
          path="/admin/broadcasts/create"
          element={
            <PermissionRoute permission="broadcasts:read">
              <LazyPage>
                <AdminBroadcastCreate />
              </LazyPage>
            </PermissionRoute>
          }
        />
        <Route
          path="/admin/promocodes"
          element={
            <PermissionRoute permission="promocodes:read">
              <LazyPage>
                <AdminPromocodes />
              </LazyPage>
            </PermissionRoute>
          }
        />
        <Route
          path="/admin/promocodes/create"
          element={
            <PermissionRoute permission="promocodes:read">
              <LazyPage>
                <AdminPromocodeCreate />
              </LazyPage>
            </PermissionRoute>
          }
        />
        <Route
          path="/admin/promocodes/:id/edit"
          element={
            <PermissionRoute permission="promocodes:read">
              <LazyPage>
                <AdminPromocodeCreate />
              </LazyPage>
            </PermissionRoute>
          }
        />
        <Route
          path="/admin/promocodes/:id/stats"
          element={
            <PermissionRoute permission="promocodes:read">
              <LazyPage>
                <AdminPromocodeStats />
              </LazyPage>
            </PermissionRoute>
          }
        />
        <Route
          path="/admin/promo-groups"
          element={
            <PermissionRoute permission="promo_groups:read">
              <LazyPage>
                <AdminPromoGroups />
              </LazyPage>
            </PermissionRoute>
          }
        />
        <Route
          path="/admin/promo-groups/create"
          element={
            <PermissionRoute permission="promo_groups:read">
              <LazyPage>
                <AdminPromoGroupCreate />
              </LazyPage>
            </PermissionRoute>
          }
        />
        <Route
          path="/admin/promo-groups/:id/edit"
          element={
            <PermissionRoute permission="promo_groups:read">
              <LazyPage>
                <AdminPromoGroupCreate />
              </LazyPage>
            </PermissionRoute>
          }
        />
        <Route
          path="/admin/campaigns"
          element={
            <PermissionRoute permission="campaigns:read">
              <LazyPage>
                <AdminCampaigns />
              </LazyPage>
            </PermissionRoute>
          }
        />
        <Route
          path="/admin/campaigns/create"
          element={
            <PermissionRoute permission="campaigns:read">
              <LazyPage>
                <AdminCampaignCreate />
              </LazyPage>
            </PermissionRoute>
          }
        />
        <Route
          path="/admin/campaigns/:id/stats"
          element={
            <PermissionRoute permission="campaigns:read">
              <LazyPage>
                <AdminCampaignStats />
              </LazyPage>
            </PermissionRoute>
          }
        />
        <Route
          path="/admin/campaigns/:id/edit"
          element={
            <PermissionRoute permission="campaigns:read">
              <LazyPage>
                <AdminCampaignEdit />
              </LazyPage>
            </PermissionRoute>
          }
        />
        <Route
          path="/admin/partners"
          element={
            <PermissionRoute permission="partners:read">
              <LazyPage>
                <AdminPartners />
              </LazyPage>
            </PermissionRoute>
          }
        />
        <Route
          path="/admin/partners/settings"
          element={
            <PermissionRoute permission="partners:read">
              <LazyPage>
                <AdminPartnerSettings />
              </LazyPage>
            </PermissionRoute>
          }
        />
        <Route
          path="/admin/partners/applications/:id/review"
          element={
            <PermissionRoute permission="partners:read">
              <LazyPage>
                <AdminApplicationReview />
              </LazyPage>
            </PermissionRoute>
          }
        />
        <Route
          path="/admin/partners/:userId/commission"
          element={
            <PermissionRoute permission="partners:read">
              <LazyPage>
                <AdminPartnerCommission />
              </LazyPage>
            </PermissionRoute>
          }
        />
        <Route
          path="/admin/partners/:userId/revoke"
          element={
            <PermissionRoute permission="partners:read">
              <LazyPage>
                <AdminPartnerRevoke />
              </LazyPage>
            </PermissionRoute>
          }
        />
        <Route
          path="/admin/partners/:userId/campaigns/assign"
          element={
            <PermissionRoute permission="partners:read">
              <LazyPage>
                <AdminPartnerCampaignAssign />
              </LazyPage>
            </PermissionRoute>
          }
        />
        <Route
          path="/admin/partners/:userId"
          element={
            <PermissionRoute permission="partners:read">
              <LazyPage>
                <AdminPartnerDetail />
              </LazyPage>
            </PermissionRoute>
          }
        />
        <Route
          path="/admin/withdrawals"
          element={
            <PermissionRoute permission="withdrawals:read">
              <LazyPage>
                <AdminWithdrawals />
              </LazyPage>
            </PermissionRoute>
          }
        />
        <Route
          path="/admin/withdrawals/:id/reject"
          element={
            <PermissionRoute permission="withdrawals:read">
              <LazyPage>
                <AdminWithdrawalReject />
              </LazyPage>
            </PermissionRoute>
          }
        />
        <Route
          path="/admin/withdrawals/:id"
          element={
            <PermissionRoute permission="withdrawals:read">
              <LazyPage>
                <AdminWithdrawalDetail />
              </LazyPage>
            </PermissionRoute>
          }
        />
        <Route
          path="/admin/users"
          element={
            <PermissionRoute permission="users:read">
              <LazyPage>
                <AdminUsers />
              </LazyPage>
            </PermissionRoute>
          }
        />
        <Route
          path="/admin/bulk-actions"
          element={
            <PermissionRoute permission="bulk_actions:read">
              <LazyPage>
                <AdminBulkActions />
              </LazyPage>
            </PermissionRoute>
          }
        />
        <Route
          path="/admin/payments"
          element={
            <PermissionRoute permission="payments:read">
              <LazyPage>
                <AdminPayments />
              </LazyPage>
            </PermissionRoute>
          }
        />
        <Route
          path="/admin/traffic-usage"
          element={
            <PermissionRoute permission="traffic:read">
              <LazyPage>
                <AdminTrafficUsage />
              </LazyPage>
            </PermissionRoute>
          }
        />
        <Route
          path="/admin/sales-stats"
          element={
            <PermissionRoute permission="sales_stats:read">
              <LazyPage>
                <AdminSalesStats />
              </LazyPage>
            </PermissionRoute>
          }
        />
        <Route
          path="/admin/referral-network"
          element={
            <PermissionRoute permission="stats:read">
              <LazyPage>
                <AdminReferralNetwork />
              </LazyPage>
            </PermissionRoute>
          }
        />
        <Route
          path="/admin/payment-methods"
          element={
            <PermissionRoute permission="payment_methods:read">
              <LazyPage>
                <AdminPaymentMethods />
              </LazyPage>
            </PermissionRoute>
          }
        />
        <Route
          path="/admin/payment-methods/:methodId/edit"
          element={
            <PermissionRoute permission="payment_methods:read">
              <LazyPage>
                <AdminPaymentMethodEdit />
              </LazyPage>
            </PermissionRoute>
          }
        />
        <Route
          path="/admin/promo-offers"
          element={
            <PermissionRoute permission="promo_offers:read">
              <LazyPage>
                <AdminPromoOffers />
              </LazyPage>
            </PermissionRoute>
          }
        />
        <Route
          path="/admin/promo-offers/templates/:id/edit"
          element={
            <PermissionRoute permission="promo_offers:read">
              <LazyPage>
                <AdminPromoOfferTemplateEdit />
              </LazyPage>
            </PermissionRoute>
          }
        />
        <Route
          path="/admin/promo-offers/send"
          element={
            <PermissionRoute permission="promo_offers:read">
              <LazyPage>
                <AdminPromoOfferSend />
              </LazyPage>
            </PermissionRoute>
          }
        />
        <Route
          path="/admin/remnawave"
          element={
            <PermissionRoute permission="remnawave:read">
              <LazyPage>
                <AdminRemnawave />
              </LazyPage>
            </PermissionRoute>
          }
        />
        <Route
          path="/admin/remnawave/squads/:uuid"
          element={
            <PermissionRoute permission="remnawave:read">
              <LazyPage>
                <AdminRemnawaveSquadDetail />
              </LazyPage>
            </PermissionRoute>
          }
        />
        <Route
          path="/admin/email-templates"
          element={
            <PermissionRoute permission="email_templates:read">
              <LazyPage>
                <AdminEmailTemplates />
              </LazyPage>
            </PermissionRoute>
          }
        />
        <Route
          path="/admin/updates"
          element={
            <PermissionRoute permission="updates:read">
              <LazyPage>
                <AdminUpdates />
              </LazyPage>
            </PermissionRoute>
          }
        />
        <Route
          path="/admin/users/:id"
          element={
            <PermissionRoute permission="users:read">
              <LazyPage>
                <AdminUserDetail />
              </LazyPage>
            </PermissionRoute>
          }
        />
        <Route
          path="/admin/broadcasts/:id"
          element={
            <PermissionRoute permission="broadcasts:read">
              <LazyPage>
                <AdminBroadcastDetail />
              </LazyPage>
            </PermissionRoute>
          }
        />
        <Route
          path="/admin/pinned-messages"
          element={
            <PermissionRoute permission="pinned_messages:read">
              <LazyPage>
                <AdminPinnedMessages />
              </LazyPage>
            </PermissionRoute>
          }
        />
        <Route
          path="/admin/pinned-messages/create"
          element={
            <PermissionRoute permission="pinned_messages:read">
              <LazyPage>
                <AdminPinnedMessageCreate />
              </LazyPage>
            </PermissionRoute>
          }
        />
        <Route
          path="/admin/pinned-messages/:id/edit"
          element={
            <PermissionRoute permission="pinned_messages:read">
              <LazyPage>
                <AdminPinnedMessageCreate />
              </LazyPage>
            </PermissionRoute>
          }
        />
        <Route
          path="/admin/channel-subscriptions"
          element={
            <PermissionRoute permission="channels:read">
              <LazyPage>
                <AdminChannelSubscriptions />
              </LazyPage>
            </PermissionRoute>
          }
        />
        <Route
          path="/admin/email-templates/preview/:type/:lang"
          element={
            <PermissionRoute permission="email_templates:read">
              <LazyPage>
                <AdminEmailTemplatePreview />
              </LazyPage>
            </PermissionRoute>
          }
        />

        {/* RBAC routes */}
        <Route
          path="/admin/roles"
          element={
            <PermissionRoute permission="roles:read">
              <LazyPage>
                <AdminRoles />
              </LazyPage>
            </PermissionRoute>
          }
        />
        <Route
          path="/admin/roles/create"
          element={
            <PermissionRoute permission="roles:create">
              <LazyPage>
                <AdminRoleEdit />
              </LazyPage>
            </PermissionRoute>
          }
        />
        <Route
          path="/admin/roles/:id/edit"
          element={
            <PermissionRoute permission="roles:edit">
              <LazyPage>
                <AdminRoleEdit />
              </LazyPage>
            </PermissionRoute>
          }
        />
        <Route
          path="/admin/roles/assign"
          element={
            <PermissionRoute permission="roles:assign">
              <LazyPage>
                <AdminRoleAssign />
              </LazyPage>
            </PermissionRoute>
          }
        />
        <Route
          path="/admin/policies"
          element={
            <PermissionRoute permission="roles:read">
              <LazyPage>
                <AdminPolicies />
              </LazyPage>
            </PermissionRoute>
          }
        />
        <Route
          path="/admin/policies/create"
          element={
            <PermissionRoute permission="roles:create">
              <LazyPage>
                <AdminPolicyEdit />
              </LazyPage>
            </PermissionRoute>
          }
        />
        <Route
          path="/admin/policies/:id/edit"
          element={
            <PermissionRoute permission="roles:edit">
              <LazyPage>
                <AdminPolicyEdit />
              </LazyPage>
            </PermissionRoute>
          }
        />
        {/* News admin routes */}
        <Route
          path="/admin/news"
          element={
            <PermissionRoute permission="news:read">
              <LazyPage>
                <AdminNews />
              </LazyPage>
            </PermissionRoute>
          }
        />
        <Route
          path="/admin/news/create"
          element={
            <PermissionRoute permission="news:create">
              <LazyPage>
                <AdminNewsCreate />
              </LazyPage>
            </PermissionRoute>
          }
        />
        <Route
          path="/admin/news/:id/edit"
          element={
            <PermissionRoute permission="news:edit">
              <LazyPage>
                <AdminNewsCreate />
              </LazyPage>
            </PermissionRoute>
          }
        />

        {/* Info pages admin routes */}
        <Route
          path="/admin/info-pages"
          element={
            <PermissionRoute permission="info_pages:read">
              <LazyPage>
                <AdminInfoPages />
              </LazyPage>
            </PermissionRoute>
          }
        />
        <Route
          path="/admin/info-pages/create"
          element={
            <PermissionRoute permission="info_pages:edit">
              <LazyPage>
                <AdminInfoPageEditor />
              </LazyPage>
            </PermissionRoute>
          }
        />
        <Route
          path="/admin/info-pages/:id/edit"
          element={
            <PermissionRoute permission="info_pages:edit">
              <LazyPage>
                <AdminInfoPageEditor />
              </LazyPage>
            </PermissionRoute>
          }
        />

        <Route
          path="/admin/audit-log"
          element={
            <PermissionRoute permission="audit_log:read">
              <LazyPage>
                <AdminAuditLog />
              </LazyPage>
            </PermissionRoute>
          }
        />

        {/* Catch all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

export default App;
