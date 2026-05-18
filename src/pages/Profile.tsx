import { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { usePlatform } from '@/platform';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../store/auth';
import { authApi } from '../api/auth';
import { isValidEmail } from '../utils/validation';
import {
  notificationsApi,
  NotificationSettings,
  NotificationSettingsUpdate,
} from '../api/notifications';
import { referralApi } from '../api/referral';
import { brandingApi, type EmailAuthEnabled } from '../api/branding';
import { partnerApi } from '../api/partners';
import { withdrawalApi } from '../api/withdrawals';
import { copyToClipboard } from '../utils/clipboard';
import { CampaignCard } from '../components/partner/CampaignCard';
import { useCurrency } from '../hooks/useCurrency';
import { UI } from '../config/constants';
import { ChevronDownIcon } from '@/components/icons';
import ConnectedAccountsPanel from '@/components/profile/ConnectedAccountsPanel';

// Apple-dark surface helper
const cardCls = 'apple-card-grad rounded-2xl bg-apple-card';

// Icons
const CopyIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184"
    />
  </svg>
);

const CheckIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
  </svg>
);

const ShareIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M7 8l5-5m0 0l5 5m-5-5v12" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 15v3a2 2 0 002 2h12a2 2 0 002-2v-3" />
  </svg>
);

const PencilIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z"
    />
  </svg>
);

// ---------- Small apple-dark toggle ----------
function AppleToggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors duration-200"
      style={{ background: checked ? '#F97315' : 'rgba(120,120,128,0.32)' }}
    >
      <span
        className="absolute top-[2px] h-[27px] w-[27px] rounded-full bg-white shadow transition-all duration-200"
        style={{ left: checked ? '22px' : '2px' }}
      />
    </button>
  );
}

// ---------- Accordion section ----------
function AccordionSection({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className={`${cardCls} overflow-hidden`}>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-5 py-4 text-left"
      >
        <span className="text-[17px] font-semibold text-apple-ink">{title}</span>
        <ChevronDownIcon
          className={`h-5 w-5 text-apple-mute transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------- Status pill helper ----------
function StatusPill({
  tone,
  children,
}: {
  tone: 'green' | 'amber' | 'red' | 'blue' | 'neutral';
  children: React.ReactNode;
}) {
  const toneMap: Record<string, string> = {
    green: 'bg-apple-green/15 text-apple-green',
    amber: 'bg-apple-amber/15 text-apple-amber',
    red: 'bg-apple-red/15 text-apple-red',
    blue: 'bg-apple-blue/15 text-apple-blue',
    neutral: 'bg-apple-elevated text-apple-mute',
  };
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${toneMap[tone] ?? toneMap.neutral}`}
    >
      {children}
    </span>
  );
}

function getWithdrawalStatusTone(status: string): 'green' | 'amber' | 'red' | 'blue' | 'neutral' {
  switch (status) {
    case 'completed':
      return 'green';
    case 'approved':
      return 'blue';
    case 'pending':
      return 'amber';
    case 'rejected':
    case 'cancelled':
      return 'red';
    default:
      return 'neutral';
  }
}

export default function Profile() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const queryClient = useQueryClient();
  const { formatAmount, currencySymbol, formatPositive, formatWithCurrency } = useCurrency();

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Accordion open state
  const [openSection, setOpenSection] = useState<string | null>('account');
  const toggleSection = (key: string) => setOpenSection((prev) => (prev === key ? null : key));

  // Inline email change flow
  const [changeEmailStep, setChangeEmailStep] = useState<'email' | 'code' | 'success' | null>(null);
  const [newEmail, setNewEmail] = useState('');
  const [changeCode, setChangeCode] = useState('');
  const [changeError, setChangeError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [verificationResendCooldown, setVerificationResendCooldown] = useState(0);
  const newEmailInputRef = useRef<HTMLInputElement>(null);
  const codeInputRef = useRef<HTMLInputElement>(null);

  // Referral copy state
  const [copiedLink, setCopiedLink] = useState<'cabinet' | 'bot' | null>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  // Referral data
  const { data: referralInfo } = useQuery({
    queryKey: ['referral-info'],
    queryFn: referralApi.getReferralInfo,
  });

  const { data: referralTerms } = useQuery({
    queryKey: ['referral-terms'],
    queryFn: referralApi.getReferralTerms,
  });

  const { data: referralList } = useQuery({
    queryKey: ['referral-list'],
    queryFn: () => referralApi.getReferralList({ per_page: 10 }),
  });

  const { data: earnings } = useQuery({
    queryKey: ['referral-earnings'],
    queryFn: () => referralApi.getReferralEarnings({ per_page: 10 }),
  });

  const { data: branding } = useQuery({
    queryKey: ['branding'],
    queryFn: brandingApi.getBranding,
    staleTime: 60000,
  });

  // Partner status query
  const { data: partnerStatus } = useQuery({
    queryKey: ['partner-status'],
    queryFn: partnerApi.getStatus,
  });

  const isPartner = partnerStatus?.partner_status === 'approved';

  // Withdrawal queries (only when partner is approved)
  const { data: withdrawalBalance } = useQuery({
    queryKey: ['withdrawal-balance'],
    queryFn: withdrawalApi.getBalance,
    enabled: isPartner,
  });

  const { data: withdrawalHistory } = useQuery({
    queryKey: ['withdrawal-history'],
    queryFn: withdrawalApi.getHistory,
    enabled: isPartner,
  });

  // Withdrawal cancel mutation
  const cancelWithdrawalMutation = useMutation({
    mutationFn: withdrawalApi.cancel,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['withdrawal-balance'] });
      queryClient.invalidateQueries({ queryKey: ['withdrawal-history'] });
    },
  });

  // Check if email auth is enabled
  const { data: emailAuthConfig } = useQuery<EmailAuthEnabled>({
    queryKey: ['email-auth-enabled'],
    queryFn: brandingApi.getEmailAuthEnabled,
    staleTime: 60000,
  });
  const isEmailAuthEnabled = emailAuthConfig?.enabled ?? true;
  const isEmailVerificationEnabled = emailAuthConfig?.verification_enabled ?? true;

  // Referral program enabled flag
  const isReferralEnabled = referralTerms?.is_enabled !== false;

  // Build referral links
  const referralLink = referralInfo?.referral_code
    ? `${window.location.origin}/login?ref=${referralInfo.referral_code}`
    : '';
  const botReferralLink = referralInfo?.bot_referral_link || '';

  const copyLink = async (link: string, type: 'cabinet' | 'bot') => {
    if (!link) return;
    try {
      await copyToClipboard(link);
      setCopiedLink(type);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopiedLink(null), 2000);
    } catch {
      // clipboard write failed silently
    }
  };

  const shareReferralLink = () => {
    if (!referralLink) return;
    const shareText = t('referral.shareMessage', {
      percent: referralInfo?.commission_percent || 0,
      botName: branding?.name || import.meta.env.VITE_APP_NAME || 'Cabinet',
    });

    if (navigator.share) {
      navigator
        .share({
          title: t('referral.title'),
          text: shareText,
          url: referralLink,
        })
        .catch(() => {});
      return;
    }

    const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(
      referralLink,
    )}&text=${encodeURIComponent(shareText)}`;
    window.open(telegramUrl, '_blank', 'noopener,noreferrer');
  };

  // Program terms memo
  const programTerms = useMemo(() => {
    if (!referralTerms) return null;
    const showNewUserBonus = referralTerms.first_topup_bonus_kopeks > 0;
    const showInviterBonus = referralTerms.inviter_bonus_kopeks > 0;

    return (
      <div>
        <h3 className="mb-3 text-[15px] font-semibold text-apple-ink">
          {t('referral.terms.title')}
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-apple-elevated p-3">
            <div className="text-[13px] text-apple-mute">{t('referral.terms.commission')}</div>
            <div className="mt-1 text-[17px] font-semibold text-apple-ink">
              {referralTerms.commission_percent}%
            </div>
          </div>
          <div className="rounded-xl bg-apple-elevated p-3">
            <div className="text-[13px] text-apple-mute">{t('referral.terms.minTopup')}</div>
            <div className="mt-1 text-[17px] font-semibold text-apple-ink">
              {formatAmount(referralTerms.minimum_topup_rubles)} {currencySymbol}
            </div>
          </div>
          {showNewUserBonus && (
            <div className="rounded-xl bg-apple-elevated p-3">
              <div className="text-[13px] text-apple-mute">{t('referral.terms.newUserBonus')}</div>
              <div className="mt-1 text-[17px] font-semibold text-apple-green">
                {formatPositive(referralTerms.first_topup_bonus_rubles)}
              </div>
            </div>
          )}
          {showInviterBonus && (
            <div className="rounded-xl bg-apple-elevated p-3">
              <div className="text-[13px] text-apple-mute">{t('referral.terms.inviterBonus')}</div>
              <div className="mt-1 text-[17px] font-semibold text-apple-green">
                {formatPositive(referralTerms.inviter_bonus_rubles)}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }, [referralTerms, t, formatAmount, formatPositive, currencySymbol]);

  const resendVerificationMutation = useMutation({
    mutationFn: authApi.resendVerification,
    onSuccess: () => {
      setSuccess(t('profile.verificationResent'));
      setError(null);
      setVerificationResendCooldown(UI.RESEND_COOLDOWN_SEC);
    },
    onError: (err: { response?: { data?: { detail?: string } } }) => {
      setError(err.response?.data?.detail || t('common.error'));
      setSuccess(null);
    },
  });

  // Email change mutations
  const requestEmailChangeMutation = useMutation({
    mutationFn: (emailAddr: string) => authApi.requestEmailChange(emailAddr),
    onSuccess: async (data) => {
      setChangeError(null);
      if (data.expires_in_minutes === 0) {
        // Unverified email was replaced directly
        setChangeEmailStep('success');
        const updatedUser = await authApi.getMe();
        setUser(updatedUser);
      } else {
        setChangeEmailStep('code');
        setResendCooldown(UI.RESEND_COOLDOWN_SEC);
      }
    },
    onError: (err: { response?: { data?: { detail?: string } } }) => {
      const detail = err.response?.data?.detail;
      if (detail?.includes('already registered') || detail?.includes('already in use')) {
        setChangeError(t('profile.changeEmail.emailAlreadyUsed'));
      } else if (detail?.includes('same as current')) {
        setChangeError(t('profile.changeEmail.sameEmail'));
      } else if (detail?.includes('rate limit') || detail?.includes('too many')) {
        setChangeError(t('profile.changeEmail.tooManyRequests'));
      } else {
        setChangeError(detail || t('common.error'));
      }
    },
  });

  const verifyEmailChangeMutation = useMutation({
    mutationFn: (verificationCode: string) => authApi.verifyEmailChange(verificationCode),
    onSuccess: async () => {
      setChangeError(null);
      setChangeEmailStep('success');
      const updatedUser = await authApi.getMe();
      setUser(updatedUser);
      queryClient.invalidateQueries({ queryKey: ['user'] });
    },
    onError: (err: { response?: { data?: { detail?: string } } }) => {
      const detail = err.response?.data?.detail;
      if (detail?.includes('invalid') || detail?.includes('wrong')) {
        setChangeError(t('profile.changeEmail.invalidCode'));
      } else if (detail?.includes('expired')) {
        setChangeError(t('profile.changeEmail.codeExpired'));
      } else {
        setChangeError(detail || t('common.error'));
      }
    },
  });

  // Resend cooldown timers
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  useEffect(() => {
    if (verificationResendCooldown <= 0) return;
    const timer = setInterval(() => {
      setVerificationResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [verificationResendCooldown]);

  // Auto-focus inputs on step change (skip on Telegram — keyboard hides bottom nav)
  const { platform: profilePlatform } = usePlatform();
  useEffect(() => {
    if (profilePlatform === 'telegram') return;
    const timer = setTimeout(() => {
      if (changeEmailStep === 'email') newEmailInputRef.current?.focus();
      else if (changeEmailStep === 'code') codeInputRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, [changeEmailStep, profilePlatform]);

  // Auto-close success after 3s
  useEffect(() => {
    if (changeEmailStep !== 'success') return;
    const timer = setTimeout(() => resetChangeEmail(), 3000);
    return () => clearTimeout(timer);
  }, [changeEmailStep]);

  const resetChangeEmail = () => {
    setChangeEmailStep(null);
    setNewEmail('');
    setChangeCode('');
    setChangeError(null);
    setResendCooldown(0);
  };

  const handleSendChangeCode = () => {
    setChangeError(null);
    if (!newEmail.trim()) {
      setChangeError(t('profile.emailRequired'));
      return;
    }
    if (!isValidEmail(newEmail.trim())) {
      setChangeError(t('profile.invalidEmail'));
      return;
    }
    if (user?.email && newEmail.toLowerCase().trim() === user.email.toLowerCase()) {
      setChangeError(t('profile.changeEmail.sameEmail'));
      return;
    }
    requestEmailChangeMutation.mutate(newEmail.trim());
  };

  const handleVerifyChangeCode = () => {
    setChangeError(null);
    if (!changeCode.trim()) {
      setChangeError(t('profile.changeEmail.enterCode'));
      return;
    }
    if (changeCode.trim().length < 4) {
      setChangeError(t('profile.changeEmail.invalidCode'));
      return;
    }
    verifyEmailChangeMutation.mutate(changeCode.trim());
  };

  const handleResendChangeCode = () => {
    if (resendCooldown > 0) return;
    requestEmailChangeMutation.mutate(newEmail.trim());
  };

  const { data: notificationSettings, isLoading: notificationsLoading } = useQuery({
    queryKey: ['notification-settings'],
    queryFn: notificationsApi.getSettings,
  });

  const updateNotificationsMutation = useMutation({
    mutationFn: notificationsApi.updateSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-settings'] });
    },
  });

  const handleNotificationToggle = (key: keyof NotificationSettings, value: boolean) => {
    const update: NotificationSettingsUpdate = { [key]: value };
    updateNotificationsMutation.mutate(update);
  };

  const handleNotificationValue = (key: keyof NotificationSettings, value: number) => {
    const update: NotificationSettingsUpdate = { [key]: value };
    updateNotificationsMutation.mutate(update);
  };

  // Apple-dark input class
  const inputCls =
    'w-full rounded-xl bg-apple-elevated px-4 py-3 text-[15px] text-apple-ink outline-none transition-shadow placeholder:text-apple-faint focus:ring-2 focus:ring-apple-blue/60 disabled:opacity-50';

  const partnerStatusValue = partnerStatus?.partner_status ?? 'none';
  const showApplySection = partnerStatusValue === 'none';
  const showPendingSection = partnerStatusValue === 'pending';
  const showApprovedSection = partnerStatusValue === 'approved';
  const showRejectedSection = partnerStatusValue === 'rejected';

  const avatarLetter = (user?.first_name || user?.username || '?').charAt(0).toUpperCase();

  return (
    <div className="space-y-4 font-sans text-apple-ink">
      {/* ===== Hero header ===== */}
      <div className="flex flex-col items-center pt-2 text-center">
        <div
          className="flex h-16 w-16 items-center justify-center rounded-2xl bg-apple-elevated text-[30px] font-bold"
          style={{ color: '#F97315' }}
        >
          {avatarLetter}
        </div>
        <div className="mt-3 text-[22px] font-bold text-apple-ink">
          {user?.first_name} {user?.last_name}
        </div>
        {user?.username && <div className="text-[14px] text-apple-mute">@{user.username}</div>}
      </div>

      {/* ===== Аккаунт ===== */}
      <AccordionSection
        title={t('profile.accountInfo')}
        open={openSection === 'account'}
        onToggle={() => toggleSection('account')}
      >
        <div className="space-y-1">
          <div className="flex items-center justify-between border-b border-apple-hairline py-3">
            <span className="text-apple-mute">{t('profile.telegramId')}</span>
            <span className="font-medium text-apple-ink">{user?.telegram_id}</span>
          </div>
          {user?.username && (
            <div className="flex items-center justify-between border-b border-apple-hairline py-3">
              <span className="text-apple-mute">{t('profile.username')}</span>
              <span className="font-medium text-apple-ink">@{user.username}</span>
            </div>
          )}
          <div className="flex items-center justify-between border-b border-apple-hairline py-3">
            <span className="text-apple-mute">{t('profile.name')}</span>
            <span className="font-medium text-apple-ink">
              {user?.first_name} {user?.last_name}
            </span>
          </div>
          <div className="flex items-center justify-between py-3">
            <span className="text-apple-mute">{t('profile.registeredAt')}</span>
            <span className="font-medium text-apple-ink">
              {user?.created_at ? new Date(user.created_at).toLocaleDateString() : '-'}
            </span>
          </div>
        </div>
      </AccordionSection>

      {/* ===== Email ===== */}
      {isEmailAuthEnabled && (
        <AccordionSection
          title={t('profile.emailAuth')}
          open={openSection === 'email'}
          onToggle={() => toggleSection('email')}
        >
          {user?.email ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-apple-hairline py-3">
                <span className="text-apple-mute">Email</span>
                <div className="flex items-center gap-3">
                  <span className="font-medium text-apple-ink">{user.email}</span>
                  {user.email_verified ? (
                    <StatusPill tone="green">{t('profile.verified')}</StatusPill>
                  ) : isEmailVerificationEnabled ? (
                    <StatusPill tone="amber">{t('profile.notVerified')}</StatusPill>
                  ) : null}
                </div>
              </div>

              {!user.email_verified && isEmailVerificationEnabled && (
                <div className="rounded-xl border border-apple-amber/30 bg-apple-amber/10 p-4">
                  <p className="mb-4 text-sm text-apple-amber">
                    {t('profile.verificationRequired')}
                  </p>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => resendVerificationMutation.mutate()}
                      disabled={
                        verificationResendCooldown > 0 || resendVerificationMutation.isPending
                      }
                      className="rounded-full bg-[#F97315] px-5 py-2.5 text-[14px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                    >
                      {verificationResendCooldown > 0
                        ? t('profile.resendIn', { seconds: verificationResendCooldown })
                        : t('profile.resendVerification')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setChangeEmailStep('email')}
                      className="text-sm transition-colors"
                      style={{ color: '#F97315' }}
                    >
                      {t('profile.changeEmail.button')}
                    </button>
                  </div>
                </div>
              )}

              {user.email_verified && (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-apple-mute">{t('profile.canLoginWithEmail')}</p>
                  <button
                    type="button"
                    onClick={() => setChangeEmailStep('email')}
                    className="flex items-center gap-2 text-sm transition-colors"
                    style={{ color: '#F97315' }}
                  >
                    <PencilIcon />
                    <span>{t('profile.changeEmail.button')}</span>
                  </button>
                </div>
              )}

              {/* Inline email change flow */}
              <AnimatePresence>
                {changeEmailStep === 'email' && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-3 border-t border-apple-hairline pt-4">
                      <label className="block text-sm font-medium text-apple-mute">
                        {t('profile.changeEmail.newEmail')}
                      </label>
                      <input
                        ref={newEmailInputRef}
                        type="email"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleSendChangeCode();
                          }
                        }}
                        placeholder="new@email.com"
                        className={inputCls}
                        autoComplete="email"
                      />
                      {changeError && <p className="text-sm text-apple-red">{changeError}</p>}
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={handleSendChangeCode}
                          disabled={!newEmail.trim() || requestEmailChangeMutation.isPending}
                          className="rounded-full bg-[#F97315] px-5 py-2.5 text-[14px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                        >
                          {t('profile.changeEmail.sendCode')}
                        </button>
                        <button
                          type="button"
                          onClick={resetChangeEmail}
                          className="text-sm text-apple-mute hover:text-apple-ink"
                        >
                          {t('common.cancel')}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}

                {changeEmailStep === 'code' && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-3 border-t border-apple-hairline pt-4">
                      <div className="rounded-xl border border-apple-blue/30 bg-apple-blue/10 p-3">
                        <p className="text-sm text-apple-blue">
                          {t('profile.changeEmail.codeSentTo', { email: newEmail })}
                        </p>
                      </div>
                      <label className="block text-sm font-medium text-apple-mute">
                        {t('profile.changeEmail.verificationCode')}
                      </label>
                      <input
                        ref={codeInputRef}
                        type="text"
                        inputMode="numeric"
                        value={changeCode}
                        onChange={(e) => setChangeCode(e.target.value.replace(/\D/g, ''))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleVerifyChangeCode();
                          }
                        }}
                        placeholder="000000"
                        maxLength={6}
                        className={`${inputCls} text-center text-2xl tracking-[0.5em]`}
                        autoComplete="one-time-code"
                      />
                      {changeError && <p className="text-sm text-apple-red">{changeError}</p>}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={handleVerifyChangeCode}
                            disabled={!changeCode.trim() || verifyEmailChangeMutation.isPending}
                            className="rounded-full bg-[#F97315] px-5 py-2.5 text-[14px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                          >
                            {t('profile.changeEmail.verify')}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setChangeEmailStep('email');
                              setChangeCode('');
                              setChangeError(null);
                            }}
                            className="text-sm text-apple-mute hover:text-apple-ink"
                          >
                            {t('common.back')}
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={handleResendChangeCode}
                          disabled={resendCooldown > 0 || requestEmailChangeMutation.isPending}
                          className="text-sm"
                          style={{ color: resendCooldown > 0 ? '#6e6e73' : '#F97315' }}
                        >
                          {resendCooldown > 0
                            ? t('profile.changeEmail.resendIn', { seconds: resendCooldown })
                            : t('profile.changeEmail.resendCode')}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}

                {changeEmailStep === 'success' && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="border-t border-apple-hairline pt-4">
                      <div className="flex items-center gap-3 rounded-xl border border-apple-green/30 bg-apple-green/10 p-4 text-apple-green">
                        <CheckIcon />
                        <div>
                          <p className="font-medium text-apple-green">
                            {t('profile.changeEmail.success')}
                          </p>
                          <p className="text-sm text-apple-mute">{newEmail}</p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-apple-mute">{t('profile.linkEmailDescription')}</p>
              <button
                type="button"
                onClick={() => setOpenSection('accounts')}
                className="rounded-full bg-[#F97315] px-5 py-2.5 text-[14px] font-semibold text-white transition-opacity hover:opacity-90"
              >
                {t('profile.linkEmail')}
              </button>
            </div>
          )}

          {(error || success) && user?.email && (
            <div className="mt-4">
              {error && (
                <div className="rounded-xl border border-apple-red/30 bg-apple-red/10 p-4 text-sm text-apple-red">
                  {error}
                </div>
              )}
              {success && (
                <div className="rounded-xl border border-apple-green/30 bg-apple-green/10 p-4 text-sm text-apple-green">
                  {success}
                </div>
              )}
            </div>
          )}
        </AccordionSection>
      )}

      {/* ===== Реферальная программа ===== */}
      {isReferralEnabled && (
        <AccordionSection
          title={t('referral.title')}
          open={openSection === 'referral'}
          onToggle={() => toggleSection('referral')}
        >
          <div className="space-y-5">
            {/* Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 rounded-xl bg-apple-elevated p-3.5">
                <div className="text-[13px] text-apple-mute">
                  {t('referral.stats.totalReferrals')}
                </div>
                <div className="mt-1 text-[26px] font-bold text-apple-ink">
                  {referralInfo?.total_referrals || 0}
                </div>
                <div className="mt-0.5 text-[13px] text-apple-faint">
                  {referralInfo?.active_referrals || 0}{' '}
                  {t('referral.stats.activeReferrals').toLowerCase()}
                </div>
              </div>
              <div className="rounded-xl bg-apple-elevated p-3.5">
                <div className="text-[13px] text-apple-mute">
                  {t('referral.stats.totalEarnings')}
                </div>
                <div className="mt-1 text-[20px] font-bold text-apple-green">
                  {formatPositive(referralInfo?.total_earnings_rubles || 0)}
                </div>
              </div>
              <div className="rounded-xl bg-apple-elevated p-3.5">
                <div className="text-[13px] text-apple-mute">
                  {t('referral.stats.commissionRate')}
                </div>
                <div className="mt-1 text-[20px] font-bold" style={{ color: '#F97315' }}>
                  {referralInfo?.commission_percent || 0}%
                </div>
              </div>
            </div>

            {/* Referral links */}
            <div>
              <h3 className="mb-3 text-[15px] font-semibold text-apple-ink">
                {t('referral.yourLink')}
              </h3>
              <div className="space-y-3">
                {/* Bot link */}
                {botReferralLink && (
                  <div>
                    <div className="mb-1.5 flex items-center gap-2 text-[13px] font-medium text-apple-mute">
                      <svg
                        className="h-4 w-4"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        style={{ color: '#F97315' }}
                      >
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z" />
                      </svg>
                      {t('referral.botLink')}
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <input
                        type="text"
                        readOnly
                        value={botReferralLink}
                        className={`${inputCls} flex-1 text-sm`}
                      />
                      <button
                        type="button"
                        onClick={() => copyLink(botReferralLink, 'bot')}
                        className="flex shrink-0 items-center justify-center gap-2 rounded-full px-4 py-3 text-[14px] font-semibold text-white transition-opacity hover:opacity-90"
                        style={{ background: copiedLink === 'bot' ? '#30d158' : '#F97315' }}
                      >
                        {copiedLink === 'bot' ? <CheckIcon /> : <CopyIcon />}
                        <span>
                          {copiedLink === 'bot' ? t('referral.copied') : t('referral.copyLink')}
                        </span>
                      </button>
                    </div>
                  </div>
                )}
                {/* Cabinet link */}
                <div>
                  <div className="mb-1.5 flex items-center gap-2 text-[13px] font-medium text-apple-mute">
                    <svg
                      className="h-4 w-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      style={{ color: '#F97315' }}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                      />
                    </svg>
                    {t('referral.cabinetLink')}
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      type="text"
                      readOnly
                      value={referralLink}
                      className={`${inputCls} flex-1 text-sm`}
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => copyLink(referralLink, 'cabinet')}
                        disabled={!referralLink}
                        className="flex shrink-0 items-center justify-center gap-2 rounded-full px-4 py-3 text-[14px] font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                        style={{ background: copiedLink === 'cabinet' ? '#30d158' : '#F97315' }}
                      >
                        {copiedLink === 'cabinet' ? <CheckIcon /> : <CopyIcon />}
                        <span>
                          {copiedLink === 'cabinet' ? t('referral.copied') : t('referral.copyLink')}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={shareReferralLink}
                        disabled={!referralLink}
                        className="flex shrink-0 items-center justify-center gap-2 rounded-full bg-apple-elevated px-4 py-3 text-[14px] font-semibold text-apple-ink transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <ShareIcon />
                        <span>{t('referral.shareButton')}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              <p className="mt-3 text-sm text-apple-faint">
                {t('referral.shareHint', { percent: referralInfo?.commission_percent || 0 })}
              </p>
            </div>

            {/* Program terms */}
            {programTerms}

            {/* Referrals list */}
            <div>
              <h3 className="mb-3 text-[15px] font-semibold text-apple-ink">
                {t('referral.yourReferrals')}
              </h3>
              {referralList?.items && referralList.items.length > 0 ? (
                <div className="space-y-2">
                  {referralList.items.map((ref) => (
                    <div
                      key={ref.id}
                      className="flex items-center justify-between rounded-xl bg-apple-elevated p-3"
                    >
                      <div>
                        <div className="font-medium text-apple-ink">
                          {ref.first_name ||
                            ref.username ||
                            t('referral.anonymousUser', { id: ref.id })}
                        </div>
                        <div className="mt-0.5 text-xs text-apple-faint">
                          {new Date(ref.created_at).toLocaleDateString(i18n.language)}
                        </div>
                      </div>
                      {ref.has_paid ? (
                        <StatusPill tone="green">{t('referral.status.paid')}</StatusPill>
                      ) : (
                        <StatusPill tone="neutral">{t('referral.status.pending')}</StatusPill>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl bg-apple-elevated py-10 text-center">
                  <div className="text-apple-mute">{t('referral.noReferrals')}</div>
                </div>
              )}
            </div>

            {/* Earnings history */}
            {earnings?.items && earnings.items.length > 0 && (
              <div>
                <h3 className="mb-3 text-[15px] font-semibold text-apple-ink">
                  {t('referral.earningsHistory')}
                </h3>
                <div className="space-y-2">
                  {earnings.items.map((earning) => (
                    <div
                      key={earning.id}
                      className="flex items-center justify-between rounded-xl bg-apple-elevated p-3"
                    >
                      <div>
                        <div className="text-apple-ink">
                          {earning.referral_first_name ||
                            earning.referral_username ||
                            t('referral.anonymousReferral')}
                        </div>
                        <div className="mt-0.5 text-xs text-apple-faint">
                          {t(`referral.reasons.${earning.reason}`, earning.reason)} •{' '}
                          {new Date(earning.created_at).toLocaleDateString(i18n.language)}
                        </div>
                      </div>
                      <div className="font-semibold text-apple-green">
                        {formatPositive(earning.amount_rubles)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Partner application — status: none */}
            {referralTerms?.partner_section_visible !== false && showApplySection && (
              <div className="rounded-xl bg-apple-elevated p-4">
                <h3 className="text-[15px] font-semibold text-apple-ink">
                  {t('referral.partner.becomePartner')}
                </h3>
                <p className="mt-1 text-sm text-apple-mute">
                  {t('referral.partner.becomePartnerDesc')}
                </p>
                <button
                  type="button"
                  onClick={() => navigate('/referral/partner/apply')}
                  className="mt-4 rounded-full bg-[#F97315] px-6 py-2.5 text-[14px] font-semibold text-white transition-opacity hover:opacity-90"
                >
                  {t('referral.partner.applyButton')}
                </button>
              </div>
            )}

            {/* Partner application — status: pending */}
            {referralTerms?.partner_section_visible !== false && showPendingSection && (
              <div className="rounded-xl border border-apple-amber/30 bg-apple-amber/10 p-4">
                <h3 className="text-[15px] font-semibold text-apple-ink">
                  {t('referral.partner.underReview')}
                </h3>
                <p className="mt-1 text-sm text-apple-mute">
                  {t('referral.partner.underReviewDesc')}
                </p>
                {partnerStatus?.latest_application?.created_at && (
                  <p className="mt-2 text-xs text-apple-faint">
                    {t('referral.partner.submittedAt', {
                      date: new Date(
                        partnerStatus.latest_application.created_at,
                      ).toLocaleDateString(i18n.language),
                    })}
                  </p>
                )}
              </div>
            )}

            {/* Partner application — status: approved */}
            {referralTerms?.partner_section_visible !== false && showApprovedSection && (
              <div className="rounded-xl border border-apple-green/30 bg-apple-green/10 p-4">
                <div className="flex items-center gap-2">
                  <h3 className="text-[15px] font-semibold text-apple-ink">
                    {t('referral.partner.partnerStatus')}
                  </h3>
                  <StatusPill tone="green">{t('referral.partner.active')}</StatusPill>
                </div>
                <p className="mt-1 text-sm text-apple-mute">
                  {t('referral.partner.commissionInfo', {
                    percent: partnerStatus?.commission_percent ?? 0,
                  })}
                </p>
              </div>
            )}

            {/* Partner application — status: rejected */}
            {referralTerms?.partner_section_visible !== false && showRejectedSection && (
              <div className="rounded-xl border border-apple-red/30 bg-apple-red/10 p-4">
                <h3 className="text-[15px] font-semibold text-apple-ink">
                  {t('referral.partner.rejected')}
                </h3>
                {partnerStatus?.latest_application?.admin_comment && (
                  <p className="mt-1 text-sm text-apple-mute">
                    {partnerStatus.latest_application.admin_comment}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => navigate('/referral/partner/apply')}
                  className="mt-4 rounded-full bg-[#F97315] px-6 py-2.5 text-[14px] font-semibold text-white transition-opacity hover:opacity-90"
                >
                  {t('referral.partner.reapplyButton')}
                </button>
              </div>
            )}

            {/* Partner campaigns */}
            {referralTerms?.partner_section_visible !== false &&
              isPartner &&
              partnerStatus?.campaigns &&
              partnerStatus.campaigns.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-[15px] font-semibold text-apple-ink">
                    {t('referral.partner.yourCampaigns')}
                  </h3>
                  {partnerStatus.campaigns.map((campaign) => (
                    <CampaignCard key={campaign.id} campaign={campaign} />
                  ))}
                </div>
              )}

            {/* Withdrawal section (approved partners only) */}
            {referralTerms?.partner_section_visible !== false && isPartner && (
              <div className="space-y-4">
                {withdrawalBalance && (
                  <div>
                    <h3 className="mb-3 text-[15px] font-semibold text-apple-ink">
                      {t('referral.withdrawal.title')}
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-2 rounded-xl bg-apple-elevated p-4">
                        <div className="text-[13px] text-apple-mute">
                          {t('referral.withdrawal.available')}
                        </div>
                        <div className="mt-1 text-[24px] font-bold text-apple-green">
                          {formatWithCurrency(withdrawalBalance.available_total / 100)}
                        </div>
                      </div>
                      <div className="rounded-xl bg-apple-elevated p-3">
                        <div className="text-[13px] text-apple-mute">
                          {t('referral.withdrawal.totalEarned')}
                        </div>
                        <div className="mt-1 text-[17px] font-semibold text-apple-ink">
                          {formatWithCurrency(withdrawalBalance.total_earned / 100)}
                        </div>
                      </div>
                      <div className="rounded-xl bg-apple-elevated p-3">
                        <div className="text-[13px] text-apple-mute">
                          {t('referral.withdrawal.withdrawn')}
                        </div>
                        <div className="mt-1 text-[17px] font-semibold text-apple-ink">
                          {formatWithCurrency(withdrawalBalance.withdrawn / 100)}
                        </div>
                      </div>
                      <div className="rounded-xl bg-apple-elevated p-3">
                        <div className="text-[13px] text-apple-mute">
                          {t('referral.withdrawal.spent')}
                        </div>
                        <div className="mt-1 text-[17px] font-semibold text-apple-ink">
                          {formatWithCurrency(withdrawalBalance.referral_spent / 100)}
                        </div>
                      </div>
                      <div className="rounded-xl bg-apple-elevated p-3">
                        <div className="text-[13px] text-apple-mute">
                          {t('referral.withdrawal.pending')}
                        </div>
                        <div className="mt-1 text-[17px] font-semibold text-apple-amber">
                          {formatWithCurrency(withdrawalBalance.pending / 100)}
                        </div>
                      </div>
                    </div>
                    <div className="mt-4">
                      <button
                        type="button"
                        onClick={() => navigate('/referral/withdrawal/request')}
                        disabled={!withdrawalBalance.can_request}
                        className="w-full rounded-full bg-[#F97315] px-6 py-3 text-[15px] font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                      >
                        {t('referral.withdrawal.requestButton')}
                      </button>
                      {!withdrawalBalance.can_request && withdrawalBalance.cannot_request_reason ? (
                        <p className="mt-2 text-xs text-apple-faint">
                          {withdrawalBalance.cannot_request_reason}
                        </p>
                      ) : (
                        withdrawalBalance.min_amount_kopeks > 0 && (
                          <p className="mt-2 text-xs text-apple-faint">
                            {t('referral.withdrawal.minAmount', {
                              amount: formatWithCurrency(withdrawalBalance.min_amount_kopeks / 100),
                            })}
                          </p>
                        )
                      )}
                    </div>
                  </div>
                )}

                {/* Withdrawal history */}
                <div>
                  <h3 className="mb-3 text-[15px] font-semibold text-apple-ink">
                    {t('referral.withdrawal.history')}
                  </h3>
                  {withdrawalHistory?.items && withdrawalHistory.items.length > 0 ? (
                    <div className="space-y-2">
                      {withdrawalHistory.items.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between rounded-xl bg-apple-elevated p-3"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-apple-ink">
                                {formatWithCurrency(item.amount_rubles)}
                              </span>
                              <StatusPill tone={getWithdrawalStatusTone(item.status)}>
                                {t(`referral.withdrawal.status.${item.status}`, item.status)}
                              </StatusPill>
                            </div>
                            <div className="mt-0.5 text-xs text-apple-faint">
                              {new Date(item.created_at).toLocaleDateString(i18n.language)}
                              {item.payment_details && (
                                <span className="ml-1">
                                  &bull;{' '}
                                  {item.payment_details.length > 40
                                    ? `${item.payment_details.slice(0, 40)}...`
                                    : item.payment_details}
                                </span>
                              )}
                            </div>
                            {item.admin_comment && (
                              <div className="mt-1 text-xs text-apple-mute">
                                {item.admin_comment}
                              </div>
                            )}
                          </div>
                          {item.status === 'pending' && (
                            <button
                              type="button"
                              onClick={() => cancelWithdrawalMutation.mutate(item.id)}
                              disabled={cancelWithdrawalMutation.isPending}
                              className="ml-3 shrink-0 text-sm text-apple-red transition-opacity hover:opacity-80"
                            >
                              {t('common.cancel')}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl bg-apple-elevated py-8 text-center">
                      <div className="text-apple-mute">{t('referral.withdrawal.noHistory')}</div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </AccordionSection>
      )}

      {/* ===== Подключённые аккаунты ===== */}
      <AccordionSection
        title={t('profile.accounts.title')}
        open={openSection === 'accounts'}
        onToggle={() => toggleSection('accounts')}
      >
        <ConnectedAccountsPanel />
      </AccordionSection>

      {/* ===== Уведомления ===== */}
      <AccordionSection
        title={t('profile.notifications.title')}
        open={openSection === 'notifications'}
        onToggle={() => toggleSection('notifications')}
      >
        {notificationsLoading ? (
          <div className="flex justify-center py-4">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-apple-blue border-t-transparent" />
          </div>
        ) : notificationSettings ? (
          <div className="space-y-6">
            {/* Subscription Expiry */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="pr-3">
                  <p className="font-medium text-apple-ink">
                    {t('profile.notifications.subscriptionExpiry')}
                  </p>
                  <p className="text-sm text-apple-mute">
                    {t('profile.notifications.subscriptionExpiryDesc')}
                  </p>
                </div>
                <AppleToggle
                  checked={notificationSettings.subscription_expiry_enabled}
                  onChange={(checked) =>
                    handleNotificationToggle('subscription_expiry_enabled', checked)
                  }
                />
              </div>
              {notificationSettings.subscription_expiry_enabled && (
                <div className="flex items-center gap-3 pl-1">
                  <span className="text-sm text-apple-mute">
                    {t('profile.notifications.daysBeforeExpiry')}
                  </span>
                  <select
                    value={notificationSettings.subscription_expiry_days}
                    onChange={(e) =>
                      handleNotificationValue('subscription_expiry_days', Number(e.target.value))
                    }
                    className="rounded-lg bg-apple-elevated px-2 py-1 text-sm text-apple-ink outline-none"
                  >
                    {[1, 2, 3, 5, 7, 14].map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Traffic Warning */}
            <div className="space-y-3 border-t border-apple-hairline pt-6">
              <div className="flex items-center justify-between">
                <div className="pr-3">
                  <p className="font-medium text-apple-ink">
                    {t('profile.notifications.trafficWarning')}
                  </p>
                  <p className="text-sm text-apple-mute">
                    {t('profile.notifications.trafficWarningDesc')}
                  </p>
                </div>
                <AppleToggle
                  checked={notificationSettings.traffic_warning_enabled}
                  onChange={(checked) =>
                    handleNotificationToggle('traffic_warning_enabled', checked)
                  }
                />
              </div>
              {notificationSettings.traffic_warning_enabled && (
                <div className="flex items-center gap-3 pl-1">
                  <span className="text-sm text-apple-mute">
                    {t('profile.notifications.atPercent')}
                  </span>
                  <select
                    value={notificationSettings.traffic_warning_percent}
                    onChange={(e) =>
                      handleNotificationValue('traffic_warning_percent', Number(e.target.value))
                    }
                    className="rounded-lg bg-apple-elevated px-2 py-1 text-sm text-apple-ink outline-none"
                  >
                    {[50, 70, 80, 90, 95].map((p) => (
                      <option key={p} value={p}>
                        {p}%
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Balance Low */}
            <div className="space-y-3 border-t border-apple-hairline pt-6">
              <div className="flex items-center justify-between">
                <div className="pr-3">
                  <p className="font-medium text-apple-ink">
                    {t('profile.notifications.balanceLow')}
                  </p>
                  <p className="text-sm text-apple-mute">
                    {t('profile.notifications.balanceLowDesc')}
                  </p>
                </div>
                <AppleToggle
                  checked={notificationSettings.balance_low_enabled}
                  onChange={(checked) => handleNotificationToggle('balance_low_enabled', checked)}
                />
              </div>
              {notificationSettings.balance_low_enabled && (
                <div className="flex items-center gap-3 pl-1">
                  <span className="text-sm text-apple-mute">
                    {t('profile.notifications.threshold')}
                  </span>
                  <input
                    type="number"
                    value={notificationSettings.balance_low_threshold}
                    onChange={(e) =>
                      handleNotificationValue('balance_low_threshold', Number(e.target.value))
                    }
                    min={0}
                    className="w-24 rounded-lg bg-apple-elevated px-2 py-1 text-sm text-apple-ink outline-none"
                  />
                </div>
              )}
            </div>

            {/* News */}
            <div className="flex items-center justify-between border-t border-apple-hairline pt-6">
              <div className="pr-3">
                <p className="font-medium text-apple-ink">{t('profile.notifications.news')}</p>
                <p className="text-sm text-apple-mute">{t('profile.notifications.newsDesc')}</p>
              </div>
              <AppleToggle
                checked={notificationSettings.news_enabled}
                onChange={(checked) => handleNotificationToggle('news_enabled', checked)}
              />
            </div>

            {/* Promo Offers */}
            <div className="flex items-center justify-between border-t border-apple-hairline pt-6">
              <div className="pr-3">
                <p className="font-medium text-apple-ink">
                  {t('profile.notifications.promoOffers')}
                </p>
                <p className="text-sm text-apple-mute">
                  {t('profile.notifications.promoOffersDesc')}
                </p>
              </div>
              <AppleToggle
                checked={notificationSettings.promo_offers_enabled}
                onChange={(checked) => handleNotificationToggle('promo_offers_enabled', checked)}
              />
            </div>
          </div>
        ) : (
          <p className="text-apple-mute">{t('profile.notifications.unavailable')}</p>
        )}
      </AccordionSection>
    </div>
  );
}
