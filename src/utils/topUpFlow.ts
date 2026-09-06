/** A translated preparation message safe to show before any invoice is created. */
export class TopUpPreparationError extends Error {}

/** The amount displayed to the user is the only amount allowed in the invoice request. */
export function getTopUpQuote(requested: number, minimum = 0, maximum?: number | null) {
  const valid = Number.isSafeInteger(requested) && requested > 0;
  const payable = valid ? Math.max(requested, minimum) : 0;
  const exceedsMaximum = maximum != null && maximum > 0 && payable > maximum;
  return {
    payable,
    extra: valid ? payable - requested : 0,
    exceedsMaximum,
    valid: valid && Number.isSafeInteger(payable) && !exceedsMaximum,
  };
}

export function parsePaymentId(value: string | null | undefined): number | null {
  if (!value || !/^[1-9]\d*$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
}

interface SavedPaymentIdentity {
  method_id: string;
  payment_id: string;
  local_payment_id?: number;
  payment_url?: string;
  amount_kopeks: number;
}

export interface TopUpIdentity {
  id: number | null;
  method: string;
  reference?: string;
  paymentUrl?: string;
  amountKopeks?: number;
}

/** Provider references and database IDs are different namespaces. */
export function getTopUpIdentity(
  params: URLSearchParams,
  saved: SavedPaymentIdentity | null,
): TopUpIdentity | null {
  const explicitLocalId = params.get('local_payment_id');
  const urlMethod = params.get('method');
  if (explicitLocalId !== null) {
    const id = parsePaymentId(explicitLocalId);
    return id && urlMethod ? { id, method: urlMethod } : null;
  }
  const providerReference = params.get('payment_id');
  if (
    !saved ||
    (urlMethod && urlMethod !== saved.method_id) ||
    (providerReference && providerReference !== saved.payment_id)
  )
    return null;
  const localId = parsePaymentId(String(saved.local_payment_id ?? ''));
  // Legacy storage does not establish whether payment_id meant provider or local.
  if (!localId && !saved.payment_url) return null;
  return {
    id: localId,
    method: saved.method_id,
    reference: saved.payment_id,
    paymentUrl: saved.payment_url,
    amountKopeks: saved.amount_kopeks,
  };
}

export interface CreatedPaymentReference {
  method: string;
  reference: string;
  paymentUrl: string;
  amountKopeks: number;
}

export function matchesCreatedPayment(
  payment: {
    id: number;
    method: string;
    identifier: string;
    payment_url: string | null;
    amount_kopeks: number;
  },
  created: CreatedPaymentReference,
) {
  // A generic provider URL/amount alone can refer to multiple purchases.
  const referenceMatches = ['cryptobot', 'platega'].includes(created.method)
    ? String(payment.identifier) === created.reference
    : String(payment.id) === created.reference || String(payment.identifier) === created.reference;
  return (
    created.method !== 'tribute' &&
    referenceMatches &&
    payment.method === created.method &&
    payment.payment_url === created.paymentUrl &&
    payment.amount_kopeks === created.amountKopeks
  );
}

/** A local cabinet route only; never navigate to a provider-controlled return URL. */
export function safeTopUpReturnPath(value: string | null | undefined): string | undefined {
  if (
    !value ||
    !/^\/(?:subscriptions(?:\/\d+(?:\/renew)?)?|subscription(?:\/purchase)?)(?:\?[^#]*)?$/.test(
      value,
    )
  ) {
    return undefined;
  }
  return value;
}

export function paymentPollInterval(start: number, now: number, terminal: boolean) {
  return terminal || now - start >= 10 * 60 * 1000 ? false : 3_000;
}
