import type { ReachabilityStatus } from '@/api/reachability';

/** Synthetic projection of StatusResponse, never production account data.
 * Bot 70c8835b65dd7b82ff023c78b20ccb0524ebeee6:
 * app/cabinet/schemas/reachability.py and routes/admin_reachability.py.
 */
export const reachabilityStatus: ReachabilityStatus = {
  enabled: true,
  configured: true,
  healthy: true,
  health_message: null,
  balance_kopeks: 100_018,
  bonus_kopeks: 0,
  tier: 'gold',
  tier_expires_at: null,
  min_interval_sec: 1,
  active_jobs: [],
  reference: null,
  cost_limit_kopeks: 0,
  cores: {},
  default_sni: 'ads.x5.ru',
  active_batch: null,
};
