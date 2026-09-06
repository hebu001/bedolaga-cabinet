import {
  parseInitDataQuery,
  parseLaunchParamsQuery,
  serializeLaunchParamsQuery,
  mockTelegramEnv,
  retrieveLaunchParams,
  initData,
} from '@telegram-apps/sdk';
import DOMPurify from 'dompurify';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
const check = (condition, message) => {
  if (!condition) throw new Error(message);
};
try {
  const raw = new URLSearchParams({
    auth_date: '1700000000',
    hash: 'synthetic-hash',
    signature: 'synthetic-signature',
    user: JSON.stringify({ id: 42, first_name: 'Fixture', language_code: 'ru' }),
    start_param: 'fixture',
  }).toString();
  const parsed = parseInitDataQuery(raw);
  check(
    parsed.user.id === 42 && parsed.auth_date instanceof Date && parsed.start_param === 'fixture',
    'Init data parser lost fields',
  );
  let rejectsInvalid = false;
  try {
    parseInitDataQuery(
      new URLSearchParams({
        auth_date: 'bad',
        hash: 'x',
        signature: 'x',
        user: '{"id":"invalid"}',
      }).toString(),
    );
  } catch {
    rejectsInvalid = true;
  }
  check(rejectsInvalid, 'Invalid init data accepted');
  const launchRaw = new URLSearchParams({
    tgWebAppPlatform: 'tdesktop',
    tgWebAppVersion: '8.0',
    tgWebAppThemeParams: JSON.stringify({ bg_color: '#ffffff', text_color: '#000000' }),
    tgWebAppData: raw,
  }).toString();
  const launch = parseLaunchParamsQuery(launchRaw);
  check(
    launch.tgWebAppData.user.id === 42 && launch.tgWebAppThemeParams.bg_color === '#ffffff',
    'Launch parser failed',
  );
  check(
    parseLaunchParamsQuery(serializeLaunchParamsQuery(launch)).tgWebAppData.user.id === 42,
    'Launch round trip failed',
  );
  mockTelegramEnv({ launchParams: launchRaw });
  check(retrieveLaunchParams().tgWebAppPlatform === 'tdesktop', 'Bridge retrieval failed');
  initData.restore();
  check(initData.user().id === 42, 'SDK reactive init data restore failed');
  const sanitized = DOMPurify.sanitize(
    '<img src=x onerror="window.__executed=true"><script>window.__executed=true</script><a href="javascript:alert(1)">bad</a><a href="https://example.com">safe</a>',
  );
  check(
    !/onerror|<script|javascript:/i.test(sanitized) && sanitized.includes('https://example.com'),
    'DOMPurify failed string sanitization',
  );
  const editor = new Editor({
    element: document.querySelector('#editor'),
    extensions: [StarterKit],
    content: '<p>Hello <strong>World</strong></p>',
  });
  check(editor.getHTML().includes('<strong>World</strong>'), 'Tiptap schema/render failed');
  editor.commands.insertContent('<p>Next</p>');
  check(editor.getText().includes('Next'), 'Tiptap mutation failed');
  editor.destroy();
  window.__dependencyResult = {
    pass: true,
    checks: [
      'SDK init data',
      'invalid input rejection',
      'launch round trip',
      'bridge retrieval',
      'reactive restore',
      'DOMPurify string sanitization',
      'Tiptap render/edit/destroy',
    ],
  };
} catch (error) {
  window.__dependencyResult = { pass: false, error: String(error.stack || error) };
}
