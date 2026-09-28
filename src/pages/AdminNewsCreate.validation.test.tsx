// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { newsApi } from '../api/news';
import AdminNewsCreate from './AdminNewsCreate';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@tiptap/react', () => ({ useEditor: () => null, EditorContent: () => null }));
vi.mock('../platform/hooks/useHaptic', () => ({
  useHapticFeedback: () => ({ success() {}, error() {}, buttonPress() {} }),
}));
vi.mock('../api/news', () => ({
  newsApi: {
    getCategories: vi.fn(),
    getTags: vi.fn(),
    getAdminArticle: vi.fn(),
    updateArticle: vi.fn(),
    createTag: vi.fn(),
  },
}));
vi.mock('../components/admin', () => ({ AdminBackButton: () => null }));
vi.mock('../components/admin/ColoredItemCombobox', () => ({
  ColoredItemCombobox: ({
    ariaLabel,
    onCreateNew,
  }: {
    ariaLabel: string;
    onCreateNew: (name: string, color: string) => Promise<unknown>;
  }) =>
    ariaLabel === 'news.admin.tagLabel' ? (
      <button onClick={() => void onCreateNew('x'.repeat(51), '#ffffff').catch(() => {})}>
        Create long tag
      </button>
    ) : null,
}));
vi.mock('../components/admin/Toggle', () => ({ Toggle: () => null }));

const article = {
  id: 1,
  title: 'News',
  slug: 'news',
  category: 'Updates',
  category_id: 1,
  category_color: '#ffffff',
  tag: null,
  excerpt: '',
  content: '',
  is_published: false,
  is_featured: false,
  read_time_minutes: 1,
};
function mount() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/admin/news/1']}>
        <Routes>
          <Route path="/admin/news/:id" element={<AdminNewsCreate />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return screen.findByDisplayValue('News');
}
afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(newsApi.getCategories).mockResolvedValue([]);
  vi.mocked(newsApi.getTags).mockResolvedValue([]);
  vi.mocked(newsApi.getAdminArticle).mockResolvedValue(article as never);
});
describe('news editor contract boundaries', () => {
  it('blocks a pre-existing overlong excerpt instead of submitting a rejected edit', async () => {
    vi.mocked(newsApi.getAdminArticle).mockResolvedValue({
      ...article,
      excerpt: 'x'.repeat(1001),
    } as never);
    await mount();
    expect(screen.getByLabelText('news.admin.excerptLabel').getAttribute('maxlength')).toBeNull();
    fireEvent.click(screen.getAllByRole('button', { name: 'news.admin.save' })[0]);
    expect(await screen.findByText('news.admin.excerptLabel: 1001 / 1000')).toBeTruthy();
    expect(newsApi.updateArticle).not.toHaveBeenCalled();
  });
  it('allows 1000 Unicode code points and bounds further user input without splitting characters', async () => {
    await mount();
    const input = screen.getByLabelText('news.admin.excerptLabel');
    for (const count of [600, 1000]) {
      fireEvent.change(input, { target: { value: '😀'.repeat(count) } });
      expect(input).toHaveProperty('value', '😀'.repeat(count));
    }
    fireEvent.change(input, { target: { value: '😀'.repeat(1001) } });
    expect(input).toHaveProperty('value', '😀'.repeat(1000));
  });
  it('blocks an overlong selected legacy tag', async () => {
    vi.mocked(newsApi.getAdminArticle).mockResolvedValue({
      ...article,
      tag: 'x'.repeat(51),
      tag_id: 1,
    } as never);
    await mount();
    fireEvent.click(screen.getAllByRole('button', { name: 'news.admin.save' })[0]);
    expect(await screen.findByText('news.admin.tagLabel: 51 / 50')).toBeTruthy();
    expect(newsApi.updateArticle).not.toHaveBeenCalled();
  });
  it('rejects an overlong new tag before the API call', async () => {
    await mount();
    fireEvent.click(screen.getByRole('button', { name: 'Create long tag' }));
    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'news.admin.tagLabel: 51 / 50',
    );
    expect(newsApi.createTag).not.toHaveBeenCalled();
  });
  it('submits the exact boundary and presents a structured backend error', async () => {
    vi.mocked(newsApi.getAdminArticle).mockResolvedValue({
      ...article,
      excerpt: 'x'.repeat(1000),
    } as never);
    vi.mocked(newsApi.updateArticle).mockRejectedValue({
      isAxiosError: true,
      response: {
        status: 422,
        data: { detail: [{ loc: ['body', 'excerpt'], msg: 'Rejected excerpt' }] },
      },
    });
    await mount();
    fireEvent.click(screen.getAllByRole('button', { name: 'news.admin.save' })[0]);
    await waitFor(() =>
      expect(newsApi.updateArticle).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ excerpt: 'x'.repeat(1000) }),
      ),
    );
    expect(await screen.findByText('excerpt: Rejected excerpt')).toBeTruthy();
  });
});
