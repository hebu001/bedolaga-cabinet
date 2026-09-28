import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { subscriptionApi } from '../api/subscription';
import { API } from '../config/constants';
import { assertCurrentSession, getSessionGeneration, isCurrentSession } from '../utils/session';
import { safeLocal } from '../utils/safeStorage';

type Target = { subscriptionId: number | undefined; owner: number };
type Traffic = Awaited<ReturnType<typeof subscriptionApi.refreshTraffic>>;
const timestampKey = (id: number | undefined) => `traffic_refresh_ts_${id ?? 'default'}`;

/** A mutation keeps its submitted target even while the dashboard picker changes. */
export function useDashboardSubscriptionActions(
  subscriptionId: number | undefined,
  hasSubscription: boolean,
) {
  const queryClient = useQueryClient();
  const owner = useRef(getSessionGeneration()).current;
  const activeId = useRef(subscriptionId);
  activeId.current = subscriptionId;
  const [traffic, setTraffic] = useState<{ target: Target; data: Traffic } | null>(null);
  const [cooldown, setCooldown] = useState<{ target: Target; seconds: number } | null>(null);
  const isActive = useCallback(
    (target: Target) =>
      isCurrentSession(target.owner) && activeId.current === target.subscriptionId,
    [],
  );

  const deletion = useMutation({
    mutationFn: ({ hwid, ...target }: Target & { hwid: string }) => {
      assertCurrentSession(target.owner);
      return subscriptionApi.deleteDevice(hwid, target.subscriptionId);
    },
    onSuccess: (_data, target) => {
      if (!isCurrentSession(target.owner)) return;
      void queryClient.invalidateQueries({
        queryKey: ['devices', target.subscriptionId],
        exact: true,
      });
    },
  });

  const refresh = useMutation({
    mutationFn: (target: Target) => {
      assertCurrentSession(target.owner);
      return subscriptionApi.refreshTraffic(target.subscriptionId);
    },
    onSuccess: (data, target) => {
      if (!isCurrentSession(target.owner)) return;
      safeLocal.setItem(timestampKey(target.subscriptionId), Date.now().toString());
      void queryClient.invalidateQueries({
        queryKey: ['subscription', target.subscriptionId],
        exact: true,
      });
      if (!isActive(target)) return;
      setTraffic({ target, data });
      setCooldown({
        target,
        seconds: data.rate_limited && data.retry_after_seconds ? data.retry_after_seconds : 30,
      });
    },
    onError: (
      error: { response?: { status?: number; headers?: { get?: (key: string) => string } } },
      target,
    ) => {
      if (!isActive(target) || error.response?.status !== 429) return;
      const seconds = Number(error.response.headers?.get?.('Retry-After'));
      setCooldown({ target, seconds: Number.isFinite(seconds) && seconds > 0 ? seconds : 30 });
    },
  });

  useEffect(() => {
    if (!cooldown || cooldown.seconds <= 0 || !isActive(cooldown.target)) return;
    const timer = setInterval(() => {
      setCooldown((current) =>
        current && isActive(current.target)
          ? { ...current, seconds: Math.max(0, current.seconds - 1) }
          : null,
      );
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown, isActive]);

  // Independently initialize each subscription; a request for A must not suppress B.
  const autoRefreshed = useRef(new Set<string>());
  const mutateTraffic = refresh.mutate;
  useEffect(() => {
    if (!hasSubscription || !isCurrentSession(owner)) return;
    const key = timestampKey(subscriptionId);
    if (autoRefreshed.current.has(key)) return;
    autoRefreshed.current.add(key);
    const lastRefresh = Number(safeLocal.getItem(key));
    const remaining = Math.ceil((API.TRAFFIC_CACHE_MS - (Date.now() - lastRefresh)) / 1000);
    const target = { subscriptionId, owner };
    if (Number.isFinite(lastRefresh) && lastRefresh > 0 && remaining > 0) {
      setCooldown({ target, seconds: remaining });
    } else {
      mutateTraffic(target);
    }
  }, [hasSubscription, subscriptionId, owner, mutateTraffic]);

  return {
    trafficData: traffic && isActive(traffic.target) ? traffic.data : null,
    trafficRefreshCooldown: cooldown && isActive(cooldown.target) ? cooldown.seconds : 0,
    deleteDevice: (hwid: string) => deletion.mutate({ hwid, subscriptionId, owner }),
    deletingDevice: deletion.isPending && deletion.variables?.subscriptionId === subscriptionId,
  };
}
