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
  // Verified against merged bot 741feec565f9c7046ab73566d61f4a9d7fdf68f4.
  numericPanelIdentity: true,
  recurringPayments: false,
  referralLevels: false,
  graceAccess: false,
});
