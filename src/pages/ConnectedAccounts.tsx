import { useTranslation } from 'react-i18next';
import ConnectedAccountsPanel, {
  LINK_TELEGRAM_STATE_KEY,
} from '../components/profile/ConnectedAccountsPanel';

// Re-exported for OAuth/Telegram link callbacks.
export { LINK_TELEGRAM_STATE_KEY };

export default function ConnectedAccounts() {
  const { t } = useTranslation();

  return (
    <div className="space-y-4 font-sans text-apple-ink">
      <h1 className="text-[22px] font-bold text-apple-ink">{t('profile.accounts.title')}</h1>
      <div className="apple-card-grad rounded-2xl bg-apple-card p-5">
        <ConnectedAccountsPanel />
      </div>
    </div>
  );
}
