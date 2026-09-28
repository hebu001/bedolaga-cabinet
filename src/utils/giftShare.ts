import type { SentGift } from '../api/gift';

/**
 * Claim artifacts for a sent gift.
 *
 * The backend hands out canonical ones: the code is `GIFT_` + 59 characters, which is
 * exactly Telegram's 64-character `start_param` limit. `SentGift.token` is only a
 * 12-character display id — the bot rejects any claim input shorter than 48 characters,
 * so links built from it handed the recipient a deep link the bot refused to open.
 *
 * Token-derived values remain only for backends that predate the canonical fields.
 * Preserve their full claim code; a newer API may return a short display token, so
 * always prefer its canonical artifacts whenever present.
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
