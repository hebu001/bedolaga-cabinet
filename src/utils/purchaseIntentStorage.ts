const STORAGE_KEY = 'purchase_intent';
const MAX_AGE_MS = 30 * 60 * 1000; // 30 minutes

export interface PurchaseIntent {
  tariff_id: number;
  tariff_name: string;
  period_days: number;
  traffic_gb?: number;
  custom_days?: number;
  total_price_kopeks: number;
  created_at: number; // Date.now()
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function savePurchaseIntent(intent: PurchaseIntent) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(intent));
  } catch {}
}

export function loadPurchaseIntent(): PurchaseIntent | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      !isRecord(parsed) ||
      typeof parsed.tariff_id !== 'number' ||
      typeof parsed.tariff_name !== 'string' ||
      typeof parsed.period_days !== 'number' ||
      typeof parsed.total_price_kopeks !== 'number' ||
      typeof parsed.created_at !== 'number' ||
      parsed.tariff_id <= 0 ||
      parsed.period_days <= 0
    ) {
      return null;
    }
    // Discard stale entries
    if (Date.now() - (parsed.created_at as number) > MAX_AGE_MS) {
      clearPurchaseIntent();
      return null;
    }
    return {
      tariff_id: parsed.tariff_id as number,
      tariff_name: parsed.tariff_name as string,
      period_days: parsed.period_days as number,
      traffic_gb: typeof parsed.traffic_gb === 'number' ? parsed.traffic_gb : undefined,
      custom_days: typeof parsed.custom_days === 'number' ? parsed.custom_days : undefined,
      total_price_kopeks: parsed.total_price_kopeks as number,
      created_at: parsed.created_at as number,
    };
  } catch {
    return null;
  }
}

export function clearPurchaseIntent() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {}
}
