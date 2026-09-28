import { useCallback, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { AxiosError } from 'axios';
import { balanceApi } from '../../../api/balance';
import TopUpPanel from '../../balance/TopUpPanel';
import { useModalFocus } from '../../../hooks/useModalFocus';
import { TopUpPreparationError } from '../../../utils/topUpFlow';
import { getSessionGeneration, isCurrentSession } from '../../../utils/session';

export interface PurchaseTopUpSheetProps {
  missingKopeks: number;
  /** Repeat the exact purchase selection; only a 402 confirms the saved cart. */
  preparePurchase: () => Promise<unknown>;
  onClose: () => void;
}

/** The provider invoice is still created and verified by the shared TopUpPanel. */
export function PurchaseTopUpSheet({
  missingKopeks,
  preparePurchase,
  onClose,
}: PurchaseTopUpSheetProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [quotedMissing, setQuotedMissing] = useState(missingKopeks);
  const [pending, setPending] = useState(false);
  const sessionGeneration = useRef(getSessionGeneration()).current;
  const close = useCallback(() => {
    if (!pending) onClose();
  }, [onClose, pending]);
  const dialogRef = useRef<HTMLDivElement>(null);
  useModalFocus(true, dialogRef, close);
  const {
    data: methods,
    isPending,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['payment-methods'],
    queryFn: balanceApi.getPaymentMethods,
    staleTime: 60_000,
  });

  const prepare = async () => {
    if (!isCurrentSession(sessionGeneration))
      throw new TopUpPreparationError(t('common.loadError'));
    try {
      await preparePurchase();
    } catch (error) {
      if (!isCurrentSession(sessionGeneration))
        throw new TopUpPreparationError(t('common.loadError'));
      if (!(error instanceof AxiosError) || error.response?.status !== 402) throw error;
      const missing = error.response.data?.detail?.missing_amount;
      if (!Number.isSafeInteger(missing) || missing <= 0)
        throw new TopUpPreparationError(t('common.loadError'));
      if (missing !== quotedMissing) {
        setQuotedMissing(missing);
        throw new TopUpPreparationError(t('balance.amountChanged'));
      }
      return;
    }
    // A concurrent balance update can complete this purchase during preflight.
    // In that case no second invoice may be created.
    if (!isCurrentSession(sessionGeneration)) return false;
    void queryClient.invalidateQueries({ queryKey: ['balance'] });
    void queryClient.invalidateQueries({ queryKey: ['subscription'] });
    void queryClient.invalidateQueries({ queryKey: ['subscriptions-list'] });
    navigate('/subscriptions', { replace: true });
    return false;
  };

  return createPortal(
    <div
      className="apple-sheet-backdrop fixed inset-0 z-[100] flex items-end justify-center bg-black/60"
      onClick={close}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={t('balance.topUpBalance')}
        tabIndex={-1}
        className="apple-sheet-panel relative m-2.5 max-h-[88vh] w-full max-w-md overflow-y-auto rounded-[32px] bg-apple-card p-5 text-apple-ink"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">{t('balance.topUpBalance')}</h2>
          <button
            type="button"
            onClick={close}
            disabled={pending}
            aria-label={t('common.close')}
            className="h-11 w-11 rounded-full bg-apple-elevated text-xl disabled:opacity-40"
          >
            ×
          </button>
        </div>
        {isPending ? (
          <p role="status">{t('common.loading')}</p>
        ) : isError ? (
          <div role="alert">
            {t('common.loadError')}{' '}
            <button type="button" onClick={() => void refetch()} className="underline">
              {t('common.retry')}
            </button>
          </div>
        ) : (
          <TopUpPanel
            methods={methods ?? []}
            fixedAmountKopeks={quotedMissing}
            onPendingChange={setPending}
            onBeforeTopUp={prepare}
            onSuccess={onClose}
          />
        )}
      </div>
    </div>,
    document.body,
  );
}
