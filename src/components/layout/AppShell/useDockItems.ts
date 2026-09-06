import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/store/auth';

// Icons
import {
  HomeIcon,
  WalletIcon,
  UsersIcon,
  ChatIcon,
  WheelIcon,
  GlobeNavIcon,
  AdminNavIcon,
} from './icons';

export function useDockItems(wheelEnabled?: boolean) {
  const { t } = useTranslation();
  const isAdmin = useAuthStore((state) => state.isAdmin);
  // Last slot: admins get the admin panel; otherwise wheel (if enabled) or support.
  const lastItem = isAdmin
    ? { path: '/admin', label: t('nav.admin', 'Админка'), icon: AdminNavIcon }
    : wheelEnabled
      ? { path: '/wheel', label: t('nav.wheel'), icon: WheelIcon }
      : { path: '/support', label: t('nav.support'), icon: ChatIcon };

  return [
    { path: '/', label: t('nav.dashboard'), icon: HomeIcon },
    { path: '/subscriptions', label: t('nav.subscription'), icon: GlobeNavIcon },
    { path: '/balance', label: t('nav.balance'), icon: WalletIcon },
    { path: '/profile', label: t('nav.profile', 'Профиль'), icon: UsersIcon },
    lastItem,
  ];
}
