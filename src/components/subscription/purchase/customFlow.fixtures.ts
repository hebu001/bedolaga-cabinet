import type { Tariff } from '../../../types';

/** Synthetic data for component tests/visual previews; no live API contract claim. */
export const customFlowTariff: Tariff = {
  id: 7,
  name: 'EvoVPN Test',
  description: 'Тестовые данные для проверки переноса интерфейса',
  tier_level: 1,
  traffic_limit_gb: 100,
  traffic_limit_label: '100 ГБ',
  is_unlimited_traffic: false,
  device_limit: 3,
  base_device_limit: 3,
  extra_devices_count: 0,
  servers_count: 1,
  servers: [{ uuid: 'fixture-squad', name: 'Тестовый сервер' }],
  is_current: true,
  is_available: true,
  periods: [
    {
      days: 30,
      months: 1,
      label: '30 дней',
      price_kopeks: 1000,
      price_label: '10 ₽',
      price_per_month_kopeks: 1000,
      price_per_month_label: '10 ₽',
    },
    {
      days: 90,
      months: 3,
      label: '90 дней',
      price_kopeks: 3000,
      price_label: '30 ₽',
      price_per_month_kopeks: 1000,
      price_per_month_label: '10 ₽',
    },
  ],
};
