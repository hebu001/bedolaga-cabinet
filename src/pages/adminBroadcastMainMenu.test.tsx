// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlatformProvider } from '@/platform/PlatformProvider';

const capabilities = vi.hoisted(() => ({ broadcastAudience: true }));
vi.mock('@/config/integrationCapabilities', () => ({ integrationCapabilities: capabilities }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: unknown) => (typeof fallback === 'string' ? fallback : key),
    i18n: { language: 'ru', changeLanguage: () => Promise.resolve() },
  }),
  Trans: ({ children }: { children?: unknown }) => children ?? null,
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

const api = vi.hoisted(() => ({
  getFilters: vi.fn(),
  getEmailFilters: vi.fn(),
  getTariffs: vi.fn(),
  getButtons: vi.fn(),
  preview: vi.fn(),
  previewAudience: vi.fn(),
  createCombined: vi.fn(),
  uploadMedia: vi.fn(),
}));
vi.mock('../api/adminBroadcasts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/adminBroadcasts')>();
  return { ...actual, adminBroadcastsApi: { ...actual.adminBroadcastsApi, ...api } };
});

beforeEach(() => {
  vi.clearAllMocks();
  capabilities.broadcastAudience = true;
  api.getFilters.mockResolvedValue({
    filters: [{ key: 'all', label: 'Все пользователи', count: 12, group: 'basic' }],
    tariff_filters: [],
    custom_filters: [],
  });
  api.getEmailFilters.mockResolvedValue({ filters: [] });
  api.getTariffs.mockResolvedValue({ tariffs: [] });
  api.getButtons.mockResolvedValue({ buttons: [{ key: 'home', label: 'На главную' }] });
  api.preview.mockResolvedValue({ target: 'all', count: 12 });
  api.previewAudience.mockResolvedValue({ count: 12, offset: 0, limit: 50, users: [] });
  api.createCombined.mockResolvedValue({ id: 901 });
  api.uploadMedia.mockResolvedValue({ file_id: 'uploaded-document' });
});
afterEach(cleanup);

async function renderPage(entry = '/admin/broadcasts/create') {
  const AdminBroadcastCreate = (await import('./AdminBroadcastCreate')).default;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <PlatformProvider>
        <MemoryRouter initialEntries={[entry]}>
          <Routes>
            <Route path="/admin/broadcasts/create" element={<AdminBroadcastCreate />} />
            <Route path="/admin/broadcasts/:id" element={<div>detail</div>} />
          </Routes>
        </MemoryRouter>
      </PlatformProvider>
    </QueryClientProvider>,
  );
}

async function selectAudience() {
  if (capabilities.broadcastAudience) {
    fireEvent.change(screen.getByRole('combobox', { name: 'Условие фильтрации' }), {
      target: { value: 'basic' },
    });
  } else {
    fireEvent.click(screen.getByText('admin.broadcasts.selectFilterPlaceholder'));
    fireEvent.click(await screen.findByText('Все пользователи'));
  }
}

const sendButton = () => screen.getByRole('button', { name: 'admin.broadcasts.send' });

describe.each([true, false])('Main-menu broadcast, advanced audience: %s', (advanced) => {
  beforeEach(() => {
    capabilities.broadcastAudience = advanced;
  });

  it('requires an audience, confirms the count, and sends a clean menu payload', async () => {
    const { container } = await renderPage();
    fireEvent.change(screen.getByPlaceholderText('admin.broadcasts.messageTextPlaceholder'), {
      target: { value: 'Previous ordinary message' },
    });
    const fileInput = container.querySelector('input[type="file"]');
    if (!fileInput) throw new Error('Media upload input is missing');
    fireEvent.change(fileInput, {
      target: { files: [new File(['document'], 'notes.txt', { type: 'text/plain' })] },
    });
    await waitFor(() => expect(api.uploadMedia).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(
        (screen.getByRole('button', { name: 'Обновить главное меню' }) as HTMLButtonElement)
          .disabled,
      ).toBe(false),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Обновить главное меню' }));
    expect((sendButton() as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByPlaceholderText('admin.broadcasts.messageTextPlaceholder')).toBeNull();
    expect(screen.queryByText('admin.broadcasts.media')).toBeNull();
    expect(screen.queryByText('admin.broadcasts.customButtons')).toBeNull();
    expect(
      (screen.getByRole('button', { name: 'admin.broadcasts.enableEmail' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    await selectAudience();
    fireEvent.click(screen.getByRole('button', { name: '📰 Новости' }));
    fireEvent.click(sendButton());

    const dialog = await screen.findByRole('dialog', { name: 'Отправить главное меню?' });
    expect(api.createCombined).not.toHaveBeenCalled();
    await waitFor(() => expect(within(dialog).getByText('Аудитория: 12')).toBeTruthy());
    fireEvent.click(within(dialog).getByRole('button', { name: 'Отправить меню' }));

    await waitFor(() => expect(api.createCombined).toHaveBeenCalledTimes(1));
    const payload = api.createCombined.mock.calls[0][0];
    expect(payload).toEqual({
      channel: 'telegram',
      category: 'news',
      message_type: 'main_menu',
      message_text: '',
      selected_buttons: [],
      ...(advanced
        ? { audience: { conditions: [expect.objectContaining({ field: 'basic', value: 'all' })] } }
        : { target: 'all' }),
    });
    expect(payload).not.toHaveProperty('media');
    expect(payload).not.toHaveProperty('custom_buttons');
    expect(payload).not.toHaveProperty('email_subject');
  });

  it('cancel confirmation sends nothing; ordinary broadcasts still require text', async () => {
    await renderPage();
    await selectAudience();
    fireEvent.click(screen.getByRole('button', { name: 'Обновить главное меню' }));
    fireEvent.click(sendButton());
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'common.cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(api.createCombined).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Сообщение' }));
    expect((sendButton() as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByPlaceholderText('admin.broadcasts.messageTextPlaceholder'), {
      target: { value: 'Normal message' },
    });
    fireEvent.click(sendButton());
    await waitFor(() => expect(api.createCombined).toHaveBeenCalledTimes(1));
    const payload = api.createCombined.mock.calls[0][0];
    expect(payload.message_text).toBe('Normal message');
    expect(payload.selected_buttons).toEqual(['home']);
    expect(payload).not.toHaveProperty('message_type');
  });

  it('does not send when the selected audience is empty', async () => {
    api.preview.mockResolvedValue({ target: 'all', count: 0 });
    api.previewAudience.mockResolvedValue({ count: 0, offset: 0, limit: 50, users: [] });
    await renderPage();
    await selectAudience();
    fireEvent.click(screen.getByRole('button', { name: 'Обновить главное меню' }));
    fireEvent.click(sendButton());
    const dialog = await screen.findByRole('dialog');
    await waitFor(() => expect(within(dialog).getByText('Аудитория: 0')).toBeTruthy());
    expect(
      (within(dialog).getByRole('button', { name: 'Отправить меню' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(api.createCombined).not.toHaveBeenCalled();
  });

  it('blocks sending until a failed audience check is retried successfully', async () => {
    await renderPage();
    await selectAudience();
    api.preview.mockRejectedValue(new Error('offline'));
    api.previewAudience.mockImplementation(async ({ limit }) => {
      if (limit === 1) throw new Error('offline');
      return { count: 12, offset: 0, limit: 50, users: [] };
    });
    fireEvent.click(screen.getByRole('button', { name: 'Обновить главное меню' }));
    fireEvent.click(sendButton());
    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByText('Не удалось проверить аудиторию.')).toBeTruthy();
    expect(
      (within(dialog).getByRole('button', { name: 'Отправить меню' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(api.createCombined).not.toHaveBeenCalled();
    api.preview.mockResolvedValue({ target: 'all', count: 12 });
    api.previewAudience.mockResolvedValue({ count: 12, offset: 0, limit: 50, users: [] });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Повторить' }));
    await waitFor(() => expect(within(dialog).getByText('Аудитория: 12')).toBeTruthy());
    fireEvent.click(within(dialog).getByRole('button', { name: 'Отправить меню' }));
    await waitFor(() => expect(api.createCombined).toHaveBeenCalledTimes(1));
  });
});

it('switches from a preset email recipient to Telegram without reusing the email audience', async () => {
  await renderPage('/admin/broadcasts/create?email_user=42');
  expect(screen.getByPlaceholderText('admin.broadcasts.emailSubjectPlaceholder')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Обновить главное меню' }));
  expect(screen.queryByPlaceholderText('admin.broadcasts.emailSubjectPlaceholder')).toBeNull();
  expect((sendButton() as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Сообщение' }));
  fireEvent.click(screen.getByRole('button', { name: 'admin.broadcasts.enableEmail' }));
  expect(screen.queryByRole('combobox', { name: 'Email' })).toBeNull();
  expect(screen.getAllByRole('combobox', { name: 'Условие фильтрации' })).toHaveLength(2);
});

it('preview explains personalization without displaying a fabricated subscription or buttons', async () => {
  await renderPage();
  fireEvent.click(screen.getByRole('button', { name: 'Обновить главное меню' }));
  fireEvent.click(screen.getByRole('button', { name: 'Предпросмотр' }));
  const dialog = await screen.findByRole('dialog', { name: 'Обновить главное меню' });
  expect(
    within(dialog).getByText(/Меню будет сформировано отдельно для каждого получателя/),
  ).toBeTruthy();
  expect(within(dialog).queryByText('На главную')).toBeNull();
  expect(api.createCombined).not.toHaveBeenCalled();
});
