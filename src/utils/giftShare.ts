import type { SentGift } from '../api/gift';

/**
 * Claim artifacts for a sent gift.
 *
 * Merged bot v4.15.0 returns a 12-character public claim code, including for
 * migrated gifts. Prefer canonical API artifacts; older backends may supply long
 * tokens, which must remain intact when building fallback links.
 */
export interface GiftClaimArtifacts {
  code: string;
  botLink: string | null;
  cabinetLink: string;
}

export function buildGiftClaimArtifacts(
  gift: Pick<SentGift, 'token' | 'gift_code' | 'bot_claim_url' | 'cabinet_claim_url'>,
  { botUsername, origin }: { botUsername: string; origin: string },
): GiftClaimArtifacts {
  const shortCode = normalizeGiftClaimCode(gift.token);

  return {
    code: gift.gift_code ?? `GIFT-${shortCode}`,
    botLink:
      gift.bot_claim_url ??
      (botUsername ? `https://t.me/${botUsername}?start=GIFT_${shortCode}` : null),
    cabinetLink:
      gift.cabinet_claim_url ?? `${origin}/gift?tab=activate&code=${encodeURIComponent(shortCode)}`,
  };
}

export function normalizeGiftClaimCode(token: string): string {
  return token.trim();
}

export interface GiftActivationLinks {
  botLink: string | null;
  cabinetLink: string;
}

export function buildGiftActivationLinks(
  claimCode: string,
  botUsername: string | undefined,
  cabinetOrigin: string,
): GiftActivationLinks {
  // Telegram forwards start parameters verbatim: keep the valid underscore literal.
  const safeCode = encodeURIComponent(claimCode);
  const normalizedBotUsername = botUsername?.trim().replace(/^@/, '');

  return {
    botLink: normalizedBotUsername
      ? `https://t.me/${normalizedBotUsername}?start=GIFT_${safeCode}`
      : null,
    cabinetLink: `${cabinetOrigin}/gift?tab=activate&code=${safeCode}`,
  };
}

export function buildGiftShareMessage(
  intro: string,
  botLabel: string,
  cabinetLabel: string,
  links: GiftActivationLinks,
): string {
  return [
    intro.trim(),
    '',
    links.botLink ? `${botLabel} ${links.botLink}` : null,
    `${cabinetLabel} ${links.cabinetLink}`,
  ]
    .filter(Boolean)
    .join('\n');
}
