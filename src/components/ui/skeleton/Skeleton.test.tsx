// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PageSkeleton } from './PageSkeleton';
import { Skeleton, SkeletonGroup } from './Skeleton';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

afterEach(cleanup);

/** Единственный плейсхолдер в поддереве. */
function only(container: HTMLElement): HTMLElement {
  const nodes = container.querySelectorAll('span');
  expect(nodes).toHaveLength(1);
  return nodes[0] as HTMLElement;
}

describe('Skeleton', () => {
  it('по умолчанию рисует span с заливкой line и радиусом lg, без пульсации', () => {
    const { container } = render(<Skeleton />);
    const el = only(container);
    expect(el.tagName).toBe('SPAN');
    expect(el.className).toContain('bg-dark-500/40');
    expect(el.className).toContain('rounded-lg');
    expect(el.className).not.toContain('animate-pulse');
  });

  it('card renders one compact state, even for a tall card list', () => {
    const { container } = render(<Skeleton variant="card" count={6} className="h-96" />);
    expect(screen.getAllByRole('status')).toHaveLength(1);
    expect(container.querySelector('.h-96')).toBeNull();
    expect(container.querySelectorAll('.animate-spin')).toHaveLength(1);
  });

  it('circle делает плейсхолдер круглым', () => {
    const { container } = render(<Skeleton circle />);
    expect(only(container).className).toContain('rounded-full');
  });

  it('animate=false убирает пульсацию', () => {
    const { container } = render(<Skeleton animate={false} />);
    expect(only(container).className).not.toContain('animate-pulse');
  });

  it('count рисует столько же элементов', () => {
    const { container } = render(<Skeleton count={4} />);
    expect(container.querySelectorAll('span')).toHaveLength(4);
  });

  it('размер из className перекрывает авторазмер, а не дублируется', () => {
    const { container } = render(<Skeleton className="h-4 w-32" />);
    const cls = only(container).className;
    expect(cls).toContain('h-4');
    expect(cls).toContain('w-32');
    expect(cls).not.toContain('h-[1em]');
    expect(cls.split(' ')).not.toContain('w-full');
  });

  it('пробрасывает style — для рантайм-фона стеклянных тем', () => {
    const { container } = render(<Skeleton style={{ background: 'rgb(1, 2, 3)' }} />);
    expect(only(container).style.background).toBe('rgb(1, 2, 3)');
  });

  // Ключевое для скринридера: объявляет о загрузке только группа.
  it('сам ничего не объявляет скринридеру', () => {
    const { container } = render(<Skeleton />);
    const el = only(container);
    expect(el.getAttribute('role')).toBeNull();
    expect(el.getAttribute('aria-busy')).toBeNull();
    expect(el.getAttribute('aria-label')).toBeNull();
  });
});

describe('SkeletonGroup', () => {
  it('объявляет загрузку: role=status, aria-busy, подпись', () => {
    render(
      <SkeletonGroup className="space-y-2">
        <Skeleton />
      </SkeletonGroup>,
    );
    const group = screen.getByRole('status');
    expect(group).toHaveProperty('tagName', 'DIV');
    expect(group.getAttribute('aria-busy')).toBe('true');
    expect(group.getAttribute('aria-label')).toBe('common.loading');
    expect(group.className).toContain('space-y-2');
    expect(group.querySelectorAll('.animate-spin')).toHaveLength(1);
  });

  it('на десять плейсхолдеров приходится одно объявление, а не десять', () => {
    render(
      <SkeletonGroup>
        <Skeleton count={10} />
      </SkeletonGroup>,
    );
    expect(screen.getAllByRole('status')).toHaveLength(1);
  });
});

describe('PageSkeleton', () => {
  it.each(['user', 'admin'] as const)(
    'uses one compact state for %s, without mock cards',
    (variant) => {
      const { container } = render(
        <PageSkeleton variant={variant} leading={2} titleWidth="w-56">
          <div data-testid="mock-card" className="h-96" />
        </PageSkeleton>,
      );
      expect(screen.getAllByRole('status')).toHaveLength(1);
      expect(screen.getByRole('status').getAttribute('aria-busy')).toBe('true');
      expect(container.querySelector('[data-testid="mock-card"]')).toBeNull();
      expect(container.querySelector('.w-56')).toBeNull();
    },
  );

  it('does not mount children with side effects', () => {
    const mounted = vi.fn();
    function MockCard() {
      mounted();
      return <div />;
    }
    render(
      <PageSkeleton>
        <MockCard />
      </PageSkeleton>,
    );
    expect(mounted).not.toHaveBeenCalled();
  });
});
