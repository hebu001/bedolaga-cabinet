import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { getSessionGeneration, isCurrentSession } from '../utils/session';
import { tariffSelectionPath } from '../utils/legacySubscription';

type Target = { owner: number; id: number | undefined; queryId: number | undefined };

/** A late backend tariff guard must keep the subscription and login that submitted it. */
export function useTariffRequiredRecovery(
  id: number | undefined,
  queryId: number | undefined,
  closeAddons: () => void,
) {
  const client = useQueryClient();
  const navigate = useNavigate();
  const owner = useRef(getSessionGeneration()).current;
  const active = useRef({ id, queryId });
  active.current = { id, queryId };
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const isActive = (target: Target | undefined) =>
    !!target &&
    mounted.current &&
    isCurrentSession(target.owner) &&
    active.current.id === target.id &&
    active.current.queryId === target.queryId;

  return {
    capture: (): Target => ({ owner, id, queryId }),
    isActive,
    recover: (error: unknown, target: Target | undefined): boolean => {
      const response = (error as { response?: { status?: number; data?: { detail?: unknown } } })
        ?.response;
      const detail = response?.data?.detail;
      if (
        response?.status !== 400 ||
        !detail ||
        typeof detail !== 'object' ||
        !('code' in detail) ||
        detail.code !== 'tariff_required'
      ) {
        return false;
      }
      // Consume stale errors without changing the new screen or creating a payment.
      if (!isActive(target) || !target?.id) return true;
      closeAddons();
      for (const key of ['subscription', 'purchase-options', 'renewal-options']) {
        void client.invalidateQueries({ queryKey: [key, target.queryId], exact: true });
        if (target.queryId !== target.id) {
          void client.invalidateQueries({ queryKey: [key, target.id], exact: true });
        }
      }
      void client.invalidateQueries({ queryKey: ['subscriptions-list'], exact: true });
      navigate(tariffSelectionPath(target.id));
      return true;
    },
  };
}
