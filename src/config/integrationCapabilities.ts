/** Optional upstream contracts gated by verification against the merged bot.
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
  // Verified against bot 70c8835b; runtime BSCHEK_ENABLED and RBAC still apply.
  reachability: true,
  reminders: false,
  systemErrors: false,
  nodeGeoCheck: false,
  // Verified against merged bot 741feec565f9c7046ab73566d61f4a9d7fdf68f4.
  numericPanelIdentity: true,
  recurringPayments: false,
  // Verified against bot 961b2aaabca67a42d013e196c65213d7ebe47f3d (5.0.0).
  // Runtime provider enabled/configured state and RBAC still apply; see docs/upstream-1.79.
  casheraRecurringPayments: true,
  dpichecker: true,
  broadcastAudience: true,
  referralLevels: false,
  graceAccess: false,
});
