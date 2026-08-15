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
  // Protect underscores from auto-link parsers that can otherwise trim them.
  const safeCode = claimCode.replace(/_/g, '%5F');
  const normalizedBotUsername = botUsername?.trim().replace(/^@/, '');

  return {
    botLink: normalizedBotUsername
      ? `https://t.me/${normalizedBotUsername}?start=GIFT%5F${safeCode}`
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
