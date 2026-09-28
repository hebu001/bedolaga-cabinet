import { describe, expect, it } from 'vitest';
import { mergedBotContract } from '../test/fixtures/mergedBotContract';
import { buildGiftActivationLinks, buildGiftClaimArtifacts } from './giftShare';

const context = { botUsername: 'ExampleBot', origin: 'https://cab.example' };
const gift = mergedBotContract.gift;

describe('buildGiftClaimArtifacts', () => {
  it('uses the merged bot canonical 12-character public code and links unchanged', () => {
    expect(gift.token).toHaveLength(12);
    expect(buildGiftClaimArtifacts(gift, context)).toEqual({
      code: gift.gift_code,
      botLink: gift.bot_claim_url,
      cabinetLink: gift.cabinet_claim_url,
    });
  });

  it('preserves canonical artifacts even when a legacy token differs', () => {
    expect(buildGiftClaimArtifacts({ ...gift, token: 'legacy_token'.repeat(5) }, context)).toEqual({
      code: gift.gift_code,
      botLink: gift.bot_claim_url,
      cabinetLink: gift.cabinet_claim_url,
    });
  });

  it('supports the old long canonical format without rewriting it', () => {
    const code = `GIFT_${'T'.repeat(59)}`;
    const legacy = {
      token: 'T'.repeat(12),
      gift_code: code,
      bot_claim_url: `https://t.me/ExampleBot?start=${code}`,
      cabinet_claim_url: `https://cab.example/buy/gift/${'T'.repeat(64)}`,
    };
    expect(buildGiftClaimArtifacts(legacy, context)).toEqual({
      code,
      botLink: legacy.bot_claim_url,
      cabinetLink: legacy.cabinet_claim_url,
    });
  });

  it.each([gift.token, 'legacy_claim_'.repeat(4)])(
    'preserves the complete fallback code %s',
    (token) => {
      const artifacts = buildGiftClaimArtifacts(
        { token, gift_code: null, bot_claim_url: null, cabinet_claim_url: null },
        context,
      );
      expect(artifacts).toEqual({
        code: `GIFT-${token}`,
        botLink: `https://t.me/ExampleBot?start=GIFT_${token}`,
        cabinetLink: `https://cab.example/gift?tab=activate&code=${token}`,
      });
    },
  );

  it('does not invent a bot link when its username is unavailable', () => {
    expect(
      buildGiftClaimArtifacts({ token: gift.token }, { ...context, botUsername: '' }).botLink,
    ).toBeNull();
  });

  it('uses the same compact claim links on the purchase result screen', () => {
    expect(buildGiftActivationLinks(gift.token, '@ExampleBot', context.origin)).toEqual({
      botLink: gift.bot_claim_url,
      cabinetLink: gift.cabinet_claim_url,
    });
  });
});
