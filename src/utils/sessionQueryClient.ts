import { MutationCache, QueryClient } from '@tanstack/react-query';
import {
  assertCurrentSession,
  getSessionGeneration,
  isCurrentSession,
  SessionChangedError,
  subscribeSession,
} from './session';

function createSessionClient(owner: number) {
  const observers = new Map<object, () => void>();
  const mutationCache = new MutationCache({
    onMutate: () => assertCurrentSession(owner),
    onSuccess: (_data, _variables, _context, mutation) => {
      if (!isCurrentSession(owner)) {
        mutation.setOptions({
          ...mutation.options,
          onSuccess: undefined,
          onError: undefined,
          onSettled: undefined,
        });
        throw new SessionChangedError();
      }
    },
    onError: (_error, _variables, _context, mutation) => {
      if (!isCurrentSession(owner)) {
        mutation.setOptions({ ...mutation.options, onError: undefined, onSettled: undefined });
      }
    },
    onSettled: (_data, _error, _variables, _context, mutation) => {
      if (!isCurrentSession(owner))
        mutation.setOptions({ ...mutation.options, onSettled: undefined });
    },
  });
  mutationCache.subscribe((event) => {
    if (event.type === 'observerAdded') observers.set(event.observer, () => event.observer.reset());
    if (event.type === 'observerRemoved') observers.delete(event.observer);
  });
  const client = new QueryClient({
    mutationCache,
    defaultOptions: {
      queries: {
        retry: (count, error) => !(error instanceof SessionChangedError) && count < 1,
        refetchOnWindowFocus: false,
      },
    },
  });
  return {
    client,
    dispose: () => {
      // The library awaits global cache hooks before calling mutation options.
      // Remove callbacks synchronously as well, including that microtask gap.
      mutationCache.getAll().forEach((mutation) =>
        mutation.setOptions({
          ...mutation.options,
          mutationFn: async () => {
            throw new SessionChangedError();
          },
          onMutate: undefined,
          onSuccess: undefined,
          onError: undefined,
          onSettled: undefined,
          retry: false,
        }),
      );
      // MutationCache.clear does not cancel running mutations or detach their
      // observers. Reset observers first to suppress per-call mutate callbacks.
      [...observers.values()].forEach((reset) => reset());
      void client.cancelQueries();
      client.clear();
    },
  };
}

let current = createSessionClient(getSessionGeneration());
subscribeSession(() => {
  const old = current;
  current = createSessionClient(getSessionGeneration());
  old.dispose();
});

export function getSessionQueryClient(): QueryClient {
  // Synchronizes other-tab changes even before its storage event is delivered.
  getSessionGeneration();
  return current.client;
}
