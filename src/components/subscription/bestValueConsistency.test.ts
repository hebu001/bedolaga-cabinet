import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/** Operator highlights exist in both shared badges and preserved Apple Dark
 * labels. Shared badges keep their gold frame; custom labels are tested through
 * their actual period selection and tariff status semantics in the UI suites. */
const SRC = join(__dirname, '..', '..');

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return tsxFiles(path);
    return path.endsWith('.tsx') && !path.includes('.test.') ? [path] : [];
  });
}

const showcases = tsxFiles(SRC)
  .filter((path) => !path.endsWith('BestValueBadge.tsx'))
  .map((path) => ({ path: relative(SRC, path), code: readFileSync(path, 'utf8') }))
  .filter(
    ({ code }) =>
      code.includes('<BestValueBadge') ||
      (code.includes("t('subscription.bestValue')") && code.includes('is_highlighted')),
  );

const sharedBadges = showcases.filter(({ code }) => code.includes('<BestValueBadge'));

describe('плашка «Выгодно» на витринах', () => {
  it('витрины найдены', () => {
    expect(showcases.map(({ path }) => path)).toEqual(
      expect.arrayContaining([
        'pages/RenewSubscription.tsx',
        'pages/QuickPurchase.tsx',
        'pages/GiftSubscription.tsx',
        'components/subscription/purchase/TariffPurchaseForm.tsx',
        'components/subscription/purchase/TariffPickerGrid.tsx',
      ]),
    );
  });

  it.each(sharedBadges.map((s) => [s.path, s.code]))(
    '%s: общий компонент отметки сохраняет золотую рамку',
    (_path, code) => {
      expect(/bestValueFrame\(|BEST_VALUE_BORDER/.test(code)).toBe(true);
    },
  );

  it.each(showcases.map((s) => [s.path, s.code]))(
    '%s: общая плашка не прижата вниз карточки',
    (_path, code) => {
      expect(/<BestValueBadge[^>]*className="[^"]*\bmt-/.test(code)).toBe(false);
    },
  );
});
