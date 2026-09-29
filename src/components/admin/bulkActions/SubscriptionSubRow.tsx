import { CheckIcon } from '@/components/admin/legacyIcons';
import { ArchiveIcon,PhoneIcon } from '@/components/icons';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

import type { UserListItemSubscription } from '../../../api/adminUsers';

// ──────────────────────────────────────────────────────────────────
// SubscriptionSubRow + StatusBadge
//
// SubscriptionSubRow: the expanded per-user secondary <tr> rendered
// under a user row when the operator drills into multi-subscription
// users. Shows tariff, status, days remaining, traffic bar, devices.
//
// StatusBadge: the pill used both inside the sub-row and in the
// primary user-table column (subscription_status). Co-located here
// because both consumers want the same visual contract.
// ──────────────────────────────────────────────────────────────────

export interface SubscriptionSubRowProps {
  subscription: UserListItemSubscription;
  isSelected: boolean;
  onToggleSelect: () => void;
  isMultiTariff: boolean;
}

export function SubscriptionSubRow({
  subscription,
  isSelected,
  onToggleSelect,
  isMultiTariff,
}: SubscriptionSubRowProps) {
  const { t } = useTranslation();

  const days = subscription.days_remaining;
  const daysColor =
    days === 0 ? 'text-apple-red' : days <= 7 ? 'text-apple-amber' : 'text-apple-green';

  const trafficPercent =
    subscription.traffic_limit_gb > 0
      ? Math.min(100, (subscription.traffic_used_gb / subscription.traffic_limit_gb) * 100)
      : 0;
  const trafficBarColor =
    trafficPercent >= 90
      ? 'bg-error-400'
      : trafficPercent >= 70
        ? 'bg-warning-400'
        : 'bg-accent-400';

  return (
    <tr
      className={cn(
        'border-b border-apple-hairline/30 transition-colors',
        isSelected ? 'bg-[#F97315]/8' : 'bg-apple-elevated/40 hover:bg-apple-card/60',
      )}
    >
      <td className="px-3 py-2">
        {isMultiTariff && (
          <div className="flex items-center justify-center">
            <button
              onClick={onToggleSelect}
              className={cn(
                'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-all duration-150',
                isSelected
                  ? 'border-[#F97315] bg-[#F97315] shadow-[0_0_8px_rgba(var(--color-accent-500),0.4)]'
                  : 'border-dark-500 bg-apple-elevated/60 hover:border-[#F97315]/50 hover:bg-dark-600/60',
              )}
              aria-label={
                isSelected
                  ? t('admin.bulkActions.deselectUser', { name: subscription.tariff_name || '' })
                  : t('admin.bulkActions.selectUser', { name: subscription.tariff_name || '' })
              }
            >
              {isSelected && <CheckIcon className="h-3 w-3 text-white" />}
            </button>
          </div>
        )}
      </td>

      <td colSpan={7} className="px-3 py-2">
        <div className="flex items-center gap-3 pl-9">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-apple-faint" aria-hidden="true">
              <ArchiveIcon className="h-3.5 w-3.5" />
            </span>
            <span className="min-w-0 flex-1 truncate text-xs font-semibold text-apple-ink">
              {subscription.tariff_name || '—'}
            </span>
          </div>

          <StatusBadge status={subscription.status} />

          <span className={cn('text-xs font-medium tabular-nums', daysColor)}>
            {days}
            <span className="ml-0.5 text-[10px] font-normal text-apple-faint">
              {t('admin.bulkActions.daysUnit')}
            </span>
          </span>

          <div className="flex items-center gap-1.5">
            <span className="text-[10px] tabular-nums text-apple-mute">
              {subscription.traffic_used_gb.toFixed(1)} {t('admin.bulkActions.trafficOf')}{' '}
              {subscription.traffic_limit_gb} {t('admin.bulkActions.trafficGbUnit')}
            </span>
            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-apple-elevated/60">
              <div
                className={cn('h-full rounded-full transition-all duration-300', trafficBarColor)}
                style={{ width: `${trafficPercent}%` }}
              />
            </div>
          </div>

          <span className="flex items-center gap-1 text-xs text-apple-mute">
            <PhoneIcon className="h-3 w-3" />
            {subscription.device_limit}
          </span>
        </div>
      </td>
    </tr>
  );
}

export function StatusBadge({ status }: { status: string | null }) {
  const { t } = useTranslation();

  const config: Record<string, { class: string; labelKey: string }> = {
    active: {
      class: 'border-success-500/30 bg-success-500/15 text-apple-green',
      labelKey: 'admin.bulkActions.statuses.active',
    },
    expired: {
      class: 'border-error-500/30 bg-error-500/15 text-apple-red',
      labelKey: 'admin.bulkActions.statuses.expired',
    },
    trial: {
      class: 'border-warning-500/30 bg-warning-500/15 text-apple-amber',
      labelKey: 'admin.bulkActions.statuses.trial',
    },
    limited: {
      class: 'border-warning-500/30 bg-warning-500/15 text-apple-amber',
      labelKey: 'admin.bulkActions.statuses.limited',
    },
    disabled: {
      class: 'border-dark-500/30 bg-dark-500/15 text-apple-mute',
      labelKey: 'admin.bulkActions.statuses.disabled',
    },
  };

  const c = config[status || ''] || config.disabled;

  return (
    <span
      className={cn(
        'inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium leading-tight',
        c.class,
      )}
    >
      {t(c.labelKey, status || '')}
    </span>
  );
}
