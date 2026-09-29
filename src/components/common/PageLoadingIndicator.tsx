import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

const LoadingContext = createContext<(() => () => void) | null>(null);

function OrangeRing() {
  return (
    <div
      data-page-loading-indicator
      role="status"
      aria-label={document.documentElement.lang === 'ru' ? 'Загрузка…' : 'Loading'}
      className="h-10 w-10 animate-spin rounded-full border-2 border-[#F97315] border-t-transparent"
    />
  );
}

/** One animation survives translation → auth → chunk → data loading handoffs. */
export function PageLoadingProvider({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false);
  const count = useRef(0);
  const showTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const register = useCallback(() => {
    count.current += 1;
    clearTimeout(hideTimer.current);
    // Fast cached transitions do not flash a loader.
    if (count.current === 1) showTimer.current = setTimeout(() => setVisible(true), 120);
    return () => {
      count.current -= 1;
      if (count.current === 0) {
        clearTimeout(showTimer.current);
        // Bridge route redirects and successive Suspense boundaries without restarting CSS animation.
        hideTimer.current = setTimeout(() => setVisible(false), 80);
      }
    };
  }, []);
  useEffect(
    () => () => {
      clearTimeout(showTimer.current);
      clearTimeout(hideTimer.current);
    },
    [],
  );
  return (
    <LoadingContext.Provider value={register}>
      {children}
      {visible && (
        <div className="pointer-events-none fixed inset-0 z-[100] flex items-center justify-center">
          <OrangeRing />
        </div>
      )}
    </LoadingContext.Provider>
  );
}

export function PageLoadingIndicator() {
  const register = useContext(LoadingContext);
  useLayoutEffect(() => register?.(), [register]);
  return register ? null : <OrangeRing />;
}
