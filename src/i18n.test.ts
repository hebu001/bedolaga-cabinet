// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import ru from './locales/ru.json';
import en from './locales/en.json';
import htmlSource from '../index.html?raw';
import mainSource from './main.tsx?raw';

/**
 * На холодном кэше интерфейс успевал отрисоваться раньше словарей, и на экране
 * оставались сырые ключи: `auth.login`, `auth.email`, `common.or`. Ключи с
 * инлайн-дефолтом — `t('auth.register', 'Register')` — при этом рисовались
 * по-английски, отчего форма выглядела наполовину переведённой.
 *
 * Причина: локали разнесены по ленивым чанкам (`import('./locales/ru.json')`,
 * ~75 КБ gzip), `react.useSuspense` выключен, а `main.tsx` звал
 * `createRoot().render()`, не дожидаясь загрузки. С прогретым кэшем чанк
 * приходил за ~0 мс и успевал к первой отрисовке — отсюда «с некоторой
 * вероятностью».
 *
 * Здесь держится контракт: модуль i18n отдаёт промис готовности, и точка
 * входа рисует приложение только после него.
 */

vi.mock('./hooks/useTelegramSDK', () => ({ getTelegramLanguageCode: () => null }));

beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => ({
      ok: true,
      json: async () => (url.includes('/en') ? en : ru),
    })),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('готовность словарей', () => {
  it('после prepareI18n активный язык переведён, а не отдаёт ключи', async () => {
    const { default: i18n, prepareI18n } = await import('./i18n');
    await prepareI18n();
    expect(i18n.hasResourceBundle('ru', 'translation')).toBe(true);
    for (const key of ['auth.login', 'auth.email', 'auth.password', 'common.or']) {
      expect(i18n.t(key)).not.toBe(key);
    }
  });

  it('отказ словаря показывает Retry, не пустоту; повтор монтирует переведённое приложение', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('offline'));
    const { I18nBootstrap } = await import('./providers/I18nBootstrap');
    render(createElement(I18nBootstrap, null, createElement('span', null, 'translated-app')));
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBeTruthy();
    expect(screen.queryByText('translated-app')).toBeNull();
    fireEvent.click(screen.getByRole('button'));
    expect(await screen.findByText('translated-app')).toBeTruthy();
  });
});

describe('точка входа', () => {
  it('потребители переводов находятся внутри retryable I18nBootstrap', () => {
    expect(mainSource).toMatch(/<I18nBootstrap>[\s\S]*<AppWithNavigator[\s\S]*<\/I18nBootstrap>/);
  });
});

describe('тема до первой отрисовки', () => {
  it('index.html применяет сохранённую тему инлайн-скриптом', () => {
    // Тему вешает useTheme в useEffect, то есть уже ПОСЛЕ первой отрисовки,
    // а в index.html зашиты class="dark" и тёмный фон. Пользователь светлой
    // темы поэтому видит тёмную вспышку — тем заметнее, что рендер теперь
    // ждёт словари.
    expect(htmlSource).toMatch(/cabinet-theme/);
  });

  it('ключи хранилища в инлайн-скрипте совпадают с STORAGE_KEYS', async () => {
    const { STORAGE_KEYS } = await import('./config/constants');

    // Переименуют ключ в constants.ts — инлайн-скрипт молча перестанет
    // находить тему, и вспышка вернётся без единой ошибки в консоли.
    expect(htmlSource).toContain(STORAGE_KEYS.THEME);
    expect(htmlSource).toContain(STORAGE_KEYS.ENABLED_THEMES);
    expect(htmlSource).toContain(STORAGE_KEYS.BRAND_HINT);
  });

  it('фон первой отрисовки уступает фону темы из CSS приложения', () => {
    // Инлайн-стиль index.html — только заглушка до прихода CSS приложения.
    // Фон светлой темы там задаёт `.light body` (специфичность 0,1,1) через
    // операторский цвет из applyThemeColors; `@layer base` в Tailwind v3 — не
    // настоящий каскадный слой, так что более специфичный селектор в index.html
    // (`html.light body`, 0,1,2) молча перекрывал бы кастомный фон навсегда.
    const inlineCss = /<style>([\s\S]*?)<\/style>/.exec(htmlSource)?.[1];
    expect(inlineCss).toBeTruthy();

    const root = document.documentElement;
    const inline = document.createElement('style');
    inline.textContent = inlineCss ?? '';
    const app = document.createElement('style');
    app.textContent = '.light body { background-color: rgb(1, 2, 3); }';
    const bodyBg = () => getComputedStyle(document.body).backgroundColor;

    root.className = 'light';
    document.head.append(inline);
    try {
      // До CSS приложения заглушка обязана рисовать светлый фон, не тёмный.
      expect(bodyBg()).toBe('rgb(247, 231, 206)');

      document.head.append(app);
      expect(bodyBg()).toBe('rgb(1, 2, 3)');
    } finally {
      inline.remove();
      app.remove();
      root.className = '';
    }
  });
});
