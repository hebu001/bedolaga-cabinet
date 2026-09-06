import { Fragment, useSyncExternalStore, type ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { getSessionGeneration, subscribeSession } from '../utils/session';
import { getSessionQueryClient } from '../utils/sessionQueryClient';

export function SessionQueryProvider({ children }: { children: ReactNode }) {
  const client = useSyncExternalStore(subscribeSession, getSessionQueryClient);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

// Query/MutationObserver keeps its first client. Persistent query consumers
// need this scope (or an equivalent generation key), while one-shot auth
// callbacks must remain outside it so their token is not submitted again.
export function SessionQueryScope({ children }: { children: ReactNode }) {
  const generation = useSyncExternalStore(subscribeSession, getSessionGeneration);
  return <Fragment key={generation}>{children}</Fragment>;
}
