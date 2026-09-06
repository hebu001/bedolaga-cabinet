import { parsePaymentId, safeTopUpReturnPath } from './topUpFlow';

const STORAGE_KEY = 'topup_pending_payment';
const MAX_AGE_MS = 30 * 60 * 1000; // 30 minutes

export interface TopUpPendingInfo {
  user_id: number;
  amount_kopeks: number;
  method_id: string;
  method_name: string;
  payment_id: string;
  local_payment_id?: number;
  payment_url?: string;
  return_to?: string;
  created_at: number; // Date.now()
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function saveTopUpPendingInfo(info: TopUpPendingInfo) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(info));
  } catch {}
}

export function loadTopUpPendingInfo(currentUserId: number | undefined): TopUpPendingInfo | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      !isRecord(parsed) ||
      !currentUserId ||
      parsed.user_id !== currentUserId ||
      typeof parsed.amount_kopeks !== 'number' ||
      typeof parsed.method_id !== 'string' ||
      typeof parsed.method_name !== 'string' ||
      typeof parsed.payment_id !== 'string' ||
      typeof parsed.created_at !== 'number' ||
      !Number.isSafeInteger(parsed.amount_kopeks) ||
      !Number.isFinite(parsed.created_at) ||
      parsed.created_at > Date.now() ||
      parsed.amount_kopeks <= 0
    ) {
      return null;
    }
    // Discard stale entries
    if (Date.now() - (parsed.created_at as number) > MAX_AGE_MS) {
      clearTopUpPendingInfo();
      return null;
    }
    return {
      user_id: currentUserId,
      return_to: safeTopUpReturnPath(
        typeof parsed.return_to === 'string' ? parsed.return_to : null,
      ),
      amount_kopeks: parsed.amount_kopeks as number,
      method_id: parsed.method_id as string,
      method_name: parsed.method_name as string,
      payment_id: parsed.payment_id as string,
      local_payment_id: parsePaymentId(String(parsed.local_payment_id ?? '')) ?? undefined,
      payment_url: typeof parsed.payment_url === 'string' ? parsed.payment_url : undefined,
      created_at: parsed.created_at as number,
    };
  } catch {
    return null;
  }
}

export function clearTopUpPendingInfo() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {}
}
