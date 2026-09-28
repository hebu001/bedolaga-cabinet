import { useTranslation } from 'react-i18next';

/** Days rewards have zero monetary value; do not render them as a zero payout. */
export function ReferralReward({
  money,
  days,
  tariff,
  formatMoney,
}: {
  money: number;
  days: number;
  tariff?: string | null;
  formatMoney: (amount: number) => string;
}) {
  const { t } = useTranslation();
  const daysLabel = tariff
    ? t('referral.daysWithTariff', { count: days, tariff })
    : t('referral.days', { count: days });
  return (
    <>{days ? `${money ? `${formatMoney(money)} + ` : '+'}${daysLabel}` : formatMoney(money)}</>
  );
}
