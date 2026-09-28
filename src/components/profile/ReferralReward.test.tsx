// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ReferralReward } from './ReferralReward';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options: { count: number; tariff?: string }) =>
      `${options.count} days${key.endsWith('WithTariff') ? ` (${options.tariff})` : ''}`,
  }),
}));
afterEach(cleanup);
const formatMoney = (value: number) => `+${value} ₽`;

describe('custom profile referral rewards', () => {
  it('renders zero-money days as the actual reward, with tariff', () => {
    render(<ReferralReward money={0} days={7} tariff="Family" formatMoney={formatMoney} />);
    expect(screen.getByText('+7 days (Family)')).toBeTruthy();
    expect(screen.queryByText('+0 ₽')).toBeNull();
  });
  it('keeps both parts of mixed earnings and totals', () => {
    render(<ReferralReward money={25} days={14} formatMoney={formatMoney} />);
    expect(screen.getByText('+25 ₽ + 14 days')).toBeTruthy();
  });
  it('preserves legacy monetary rewards', () => {
    render(<ReferralReward money={25} days={0} formatMoney={formatMoney} />);
    expect(screen.getByText('+25 ₽')).toBeTruthy();
  });
});
