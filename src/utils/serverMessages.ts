// Localizes known server (English) error messages from the cabinet auth API.
//
// The backend returns human-readable English strings in `detail` without stable
// error codes, so we map them here (exact match first, then regex for variants)
// and swap in a localized i18n message. Anything unmatched falls through to the
// raw server text.
//
// Source of truth: remnawave-bedolaga-telegram-bot · app/cabinet/routes/{auth,oauth,account_linking}.py
// To localize a new message: add it below and the key to all locales under auth.serverErrors.*

type TranslateFn = (key: string) => string;

// Exact server string → i18n key. Reuses the existing auth.* keys where one fits.
const EXACT: Record<string, string> = {
  'Invalid email or password': 'auth.invalidCredentials',
  'Please verify your email first': 'auth.emailNotVerified',
  'This email is already registered': 'auth.emailAlreadyRegistered',
  'Too many requests': 'auth.tooManyAttempts',

  'Account is deactivated': 'auth.serverErrors.accountDeactivated',
  'User account is not active': 'auth.serverErrors.accountDeactivated',
  'User not found or inactive': 'auth.serverErrors.userNotFoundOrInactive',
  'Administrator accounts cannot use auto-login. Please sign in via Telegram.':
    'auth.serverErrors.adminNoAutoLogin',
  'Password login not configured for this account': 'auth.serverErrors.passwordLoginNotConfigured',

  'Disposable email addresses are not allowed': 'auth.serverErrors.disposableEmail',
  'Email is already verified': 'auth.serverErrors.emailAlreadyVerified',
  'Email service is not configured': 'auth.serverErrors.emailServiceNotConfigured',
  'Email service is not configured; cannot verify the existing account':
    'auth.serverErrors.emailServiceNotConfigured',
  'Email verification is disabled': 'auth.serverErrors.emailVerificationDisabled',
  'This email address cannot be used for registration.': 'auth.serverErrors.emailCannotRegister',
  'This email address cannot be linked to your account.': 'auth.serverErrors.emailCannotLink',
  'This email is already linked to your account': 'auth.serverErrors.emailAlreadyLinked',
  'New email is the same as current email': 'auth.serverErrors.emailSameAsCurrent',
  'No email address to change': 'auth.serverErrors.noPendingEmailChange',
  'No pending email change': 'auth.serverErrors.noPendingEmailChange',
  'No email address to verify': 'auth.serverErrors.noEmailToVerify',
  'Invalid confirmation code': 'auth.serverErrors.invalidCode',
  'Too many invalid attempts. Please request a new code.': 'auth.serverErrors.tooManyInvalidCode',

  'Invalid reset token': 'auth.serverErrors.resetTokenInvalid',
  'Reset token has expired': 'auth.serverErrors.resetTokenExpired',
  'Invalid verification token': 'auth.serverErrors.tokenInvalid',
  'Invalid token data': 'auth.serverErrors.tokenInvalid',
  'Invalid token payload': 'auth.serverErrors.tokenInvalid',
  'Invalid token state': 'auth.serverErrors.tokenInvalid',
  'Token already consumed': 'auth.serverErrors.tokenInvalid',
  'Token expired or not found': 'auth.serverErrors.tokenExpiredOrNotFound',
  'Invalid or expired auto-login token': 'auth.serverErrors.autoLoginTokenInvalid',
  'Invalid or expired refresh token': 'auth.serverErrors.sessionExpired',
  'Refresh token is no longer valid': 'auth.serverErrors.sessionExpired',
  'Refresh token not found or revoked': 'auth.serverErrors.sessionExpired',

  'Could not determine OAuth provider': 'auth.serverErrors.oauthProviderUnknown',
  'Requested OAuth provider is not available': 'auth.serverErrors.oauthProviderUnavailable',
  'Failed to exchange authorization code': 'auth.serverErrors.oauthExchangeFailed',
  'Failed to fetch user information from provider': 'auth.serverErrors.oauthFetchUserFailed',
  'Invalid or expired OAuth state': 'auth.serverErrors.oauthStateInvalid',
  'Invalid user_id in OAuth state': 'auth.serverErrors.tokenInvalid',
  'Invalid user ID in OIDC claims': 'auth.serverErrors.tokenInvalid',
  'Missing user ID in OIDC claims': 'auth.serverErrors.tokenInvalid',
  'OAuth state was initiated by a different user': 'auth.serverErrors.oauthStateMismatch',
  'OAuth state was initiated for account linking, not login':
    'auth.serverErrors.oauthStateMismatch',
  'OAuth state was not initiated for account linking': 'auth.serverErrors.oauthStateMismatch',
  'Provider does not match OAuth state': 'auth.serverErrors.oauthStateMismatch',

  'Telegram OIDC is not configured': 'auth.serverErrors.telegramOidcNotConfigured',
  'Missing Telegram user ID': 'auth.serverErrors.telegramDataInvalid',
  'Login Widget mode requires id, auth_date, and hash fields':
    'auth.serverErrors.telegramDataInvalid',
  'Provide exactly one of: init_data, id_token, or Login Widget fields':
    'auth.serverErrors.telegramProvideOne',
  'Provide init_data (Mini App), id_token (OIDC), or Login Widget fields (id, auth_date, hash)':
    'auth.serverErrors.telegramProvideOne',
  'Provide one of: init_data, id_token, or Login Widget fields (id, auth_date, hash)':
    'auth.serverErrors.telegramProvideOne',
  'This Telegram authorization has already been used. Please log in again.':
    'auth.serverErrors.telegramAuthAlreadyUsed',
  'This Telegram authorization has already been used.': 'auth.serverErrors.telegramAuthAlreadyUsed',

  'Provider is already linked to your account': 'auth.serverErrors.providerAlreadyLinked',
  'Telegram is already linked to your account': 'auth.serverErrors.providerAlreadyLinked',
  'Provider is not linked to your account': 'auth.serverErrors.providerNotLinked',
  'Cannot unlink last authentication method': 'auth.serverErrors.cannotUnlinkLast',
  'This Telegram account was just linked to another user':
    'auth.serverErrors.accountJustLinkedElsewhere',
  'This provider account was just linked to another user':
    'auth.serverErrors.accountJustLinkedElsewhere',
  'This social account is already linked to a different account. Unlink it from that account first.':
    'auth.serverErrors.socialLinkedElsewhere',

  'Account merge cannot be completed. The accounts may have already been merged or deleted.':
    'auth.serverErrors.mergeCannotComplete',
  'Account merge failed due to an internal error': 'auth.serverErrors.mergeFailed',
  'Failed to load merged user': 'auth.serverErrors.mergeFailed',
  'Merge succeeded but failed to create new session': 'auth.serverErrors.mergeSessionFailed',
  'Merge token is invalid or expired': 'auth.serverErrors.mergeTokenInvalid',
  'Merge token is invalid, expired, or already consumed': 'auth.serverErrors.mergeTokenInvalid',
  'One or both users not found': 'auth.serverErrors.mergeUsersNotFound',
  'No pending account merge. Please start again.': 'auth.serverErrors.noPendingMerge',
  'That account is no longer available to merge.': 'auth.serverErrors.mergeAccountUnavailable',
  'This merge can only be completed by the account that started it.':
    'auth.serverErrors.mergeWrongAccount',
  'Too many invalid attempts. Please start the merge again.':
    'auth.serverErrors.tooManyInvalidMerge',

  'Bot not configured': 'auth.serverErrors.botNotConfigured',
  'Service temporarily unavailable': 'auth.serverErrors.serviceUnavailable',
};

// Regex fallbacks for multi-line / variable-suffix messages (first match wins).
const RULES: { match: RegExp; key: string }[] = [
  {
    match: /exists but its email has not been verified/i,
    key: 'auth.serverErrors.emailExistsUnverified',
  },
  { match: /invalid or expired telegram/i, key: 'auth.serverErrors.telegramDataInvalid' },
];

export function localizeServerMessage(
  detail: string | null | undefined,
  t: TranslateFn,
): string | null {
  if (!detail) return detail ?? null;
  const trimmed = detail.trim();

  const resolve = (key: string): string | null => {
    const localized = t(key);
    // i18next echoes the key back when it's missing — keep the server text then.
    return localized && localized !== key ? localized : null;
  };

  const exactKey = EXACT[trimmed];
  if (exactKey) {
    const localized = resolve(exactKey);
    if (localized) return localized;
  }

  for (const rule of RULES) {
    if (rule.match.test(detail)) {
      const localized = resolve(rule.key);
      if (localized) return localized;
    }
  }

  return detail;
}
