/** Optional upstream contracts awaiting verification against the merged bot.
 * These are release integration gates, not permissions or user preferences.
 * Enable only alongside schema fixtures and an explicit bot SHA in docs/upstream-1.79.
 */
export const integrationCapabilities = Object.freeze({
  advancedUserFilters: false,
  legalConsent: false,
  coupons: false,
  publicEmailResend: false,
  userAvatar: false,
  liteMode: false,
  reachability: false,
  reminders: false,
  systemErrors: false,
  nodeGeoCheck: false,
  numericPanelIdentity: false,
  recurringPayments: false,
  referralLevels: false,
  graceAccess: false,
});
