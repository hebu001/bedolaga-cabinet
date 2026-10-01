import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import {
  type CheckType,
  type CheckCreate,
  type MonitorCreate,
  dpicheckerApi,
  type Location,
  type Pop,
  type ProbeMode,
} from '@/api/dpichecker';
import { usePlatform } from '@/platform';
import { useNativeDialog } from '@/platform/hooks/useNativeDialog';
import { getApiErrorMessage } from '@/utils/api-error';
import { assertCurrentSession, getSessionGeneration, isCurrentSession } from '@/utils/session';
import { buildLink, type Tab } from './deepLink';
import { activeTargets, canPay } from './formState';
import { PopPicker } from './PopPicker';
import { type PanelKind, TargetsStep, type TargetsValue } from './TargetsStep';
import { type RunMode, type ScheduleValue, TotalStep, usd4 } from './TotalStep';
import { DPI_STATUS_KEY, useDpiStatus } from './useDpiStatus';
import { useDebouncedValue } from '../reachability/useDebouncedValue';
import { effectiveSelection } from './popSelection';

const TOPUP_URL = 'https://dpichecker.st/topup';
const ESTIMATE_DEBOUNCE_MS = 400;
const DEFAULT_SCHEDULE: ScheduleValue = {
  intervalHours: 6,
  alertAfterFails: 2,
  notifyOnSuccess: false,
  notify: 'dm',
};

/** Шаг формы — заголовок без номера «01/02», как разделы формы BSCHEKER (номера владельцу непонятны). */
function Step({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="bento-card space-y-3 p-4 sm:p-5">
      <h2 className="text-lg font-semibold text-dark-100">{title}</h2>
      {children}
    </section>
  );
}

type ApprovalRequest = (
  | { mode: 'once'; body: CheckCreate }
  | { mode: 'schedule'; body: MonitorCreate }
) & { key: string };
type ApprovedRun = ApprovalRequest & { sessionGeneration: number };

interface CheckFormProps {
  checkType: CheckType;
  prefill?: { kind: PanelKind; ref: string } | null;
}

/**
 * Проверка VPN / IP / MTProto в три шага, как на dpichecker.st: «Что проверяем» → «Откуда
 * проверяем» → «Итого» с ценой от сервиса и оплатой после подтверждения суммы. Тот же экран
 * создаёт монитор («По расписанию»): каждый его прогон стоит как такая проверка.
 */
export function CheckForm({ checkType, prefill = null }: CheckFormProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { openLink, platform } = usePlatform();
  const dialog = useNativeDialog();
  const { data: status } = useDpiStatus();

  const [targets, setTargets] = useState<TargetsValue>({
    resources: [],
    source: 'paste',
    sourceRef: null,
  });
  const [location, setLocation] = useState<Location>('russia');
  const [pops, setPops] = useState<Pop[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [probeMode, setProbeMode] = useState<ProbeMode>('auto');
  const [runMode, setRunMode] = useState<RunMode>('once');
  const [schedule, setSchedule] = useState<ScheduleValue>(DEFAULT_SCHEDULE);
  const [confirmation, setConfirmation] = useState<ApprovedRun | null>(null);
  // Два клика подряд успевают до перерисовки (isPending ещё false) — второй запуск списал бы деньги.
  const inFlight = useRef(false);

  const chosen = activeTargets(targets.resources);
  const popIds = effectiveSelection(selected, pops);
  // Строкой: объект, созданный заново на каждой отрисовке, будил бы задержку без конца.
  const currentPriceKey = JSON.stringify({
    popIds,
    values: chosen.map((target) => target.value),
    location,
  });
  const priceKey = useDebouncedValue(currentPriceKey, ESTIMATE_DEBOUNCE_MS);
  const priceInput = JSON.parse(priceKey) as {
    popIds: number[];
    values: string[];
    location: Location;
  };
  const estimate = useQuery({
    queryKey: ['dpichecker', 'estimate', checkType, priceKey],
    queryFn: () =>
      dpicheckerApi.estimate({
        check_type: checkType,
        location: priceInput.location,
        pop_ids: priceInput.popIds,
        resources: priceInput.values,
      }),
    enabled: priceInput.popIds.length > 0 && priceInput.values.length > 0,
  });
  const quoteReady =
    currentPriceKey === priceKey && estimate.isSuccess && !estimate.isFetching && !estimate.isError;
  const cost = quoteReady ? (estimate.data?.estimated_cost ?? null) : null;
  const balance = status?.balance ?? null;
  const payable =
    quoteReady &&
    cost !== null &&
    Number.isFinite(cost) &&
    cost >= 0 &&
    canPay({ pops: popIds.length, resources: targets.resources, cost, balance });
  const body: CheckCreate = {
    check_type: checkType,
    location,
    pop_ids: popIds,
    targets: chosen,
    source: targets.source,
    source_ref: targets.sourceRef,
    probe_mode: probeMode,
  };
  const request =
    runMode === 'schedule'
      ? {
          ...body,
          interval_hours: schedule.intervalHours,
          alert_after_fails: schedule.alertAfterFails,
          notify_on_success: schedule.notifyOnSuccess,
          notify: schedule.notify,
        }
      : body;
  const approvalKey = JSON.stringify({ mode: runMode, body: request, cost, balance });
  const currentApproval: ApprovalRequest =
    runMode === 'schedule'
      ? { mode: 'schedule', body: request as MonitorCreate, key: approvalKey }
      : { mode: 'once', body, key: approvalKey };
  const latestApproval = useRef({ payable, approval: currentApproval });
  latestApproval.current = { payable, approval: currentApproval };
  useEffect(
    () => () => {
      latestApproval.current.payable = false;
    },
    [],
  );
  const confirming = confirmation !== null && confirmation.key === approvalKey && payable;
  useEffect(() => {
    if (confirmation && (!payable || confirmation.key !== approvalKey)) setConfirmation(null);
  }, [confirmation, payable, approvalKey]);
  const short = cost !== null && balance !== null && cost > balance;

  const launch = useMutation({
    onSettled: () => {
      inFlight.current = false;
    },
    mutationFn: (approved: ApprovedRun) => {
      // React Query can defer this call until after the approving session has ended.
      assertCurrentSession(approved.sessionGeneration);
      return approved.mode === 'schedule'
        ? dpicheckerApi.createMonitor(approved.body)
        : dpicheckerApi.launchCheck(approved.body);
    },
    onSuccess: (action, approved) => {
      void queryClient.invalidateQueries({ queryKey: DPI_STATUS_KEY });
      setConfirmation(null);
      navigate(
        approved.mode === 'schedule'
          ? buildLink({ tab: 'monitors' })
          : buildLink({ tab: checkType as Tab, check: action.id }),
      );
    },
    onError: () => setConfirmation(null),
  });

  const confirmLabel =
    runMode === 'schedule'
      ? t('admin.dpichecker.form.confirmMonitor', { value: usd4(cost) })
      : t('admin.dpichecker.form.confirmPay', { value: usd4(cost) });
  const submitApproved = useCallback(
    (approved: ApprovedRun) => {
      const latest = latestApproval.current;
      if (
        !isCurrentSession(approved.sessionGeneration) ||
        !latest.payable ||
        latest.approval.key !== approved.key ||
        inFlight.current ||
        launch.isPending
      )
        return;
      inFlight.current = true;
      launch.mutate(approved);
    },
    [launch],
  );
  const startPay = useCallback(async () => {
    if (!payable || launch.isPending) return;
    const approved: ApprovedRun = {
      ...currentApproval,
      sessionGeneration: getSessionGeneration(),
    };
    // A native popup can outlive edits or a quote refresh; submit only its original snapshot.
    if (platform === 'telegram') {
      if (await dialog.confirm(confirmLabel)) submitApproved(approved);
      return;
    }
    setConfirmation(approved);
  }, [payable, launch.isPending, currentApproval, platform, dialog, confirmLabel, submitApproved]);

  const onPops = useCallback((loaded: Pop[]) => setPops(loaded), []);
  const hasTargets = chosen.length > 0;

  return (
    <div className="space-y-4">
      <Step title={t('admin.dpichecker.form.step1')}>
        <TargetsStep
          checkType={checkType}
          value={targets}
          onChange={setTargets}
          prefill={prefill}
        />
      </Step>
      {hasTargets && (
        <Step title={t('admin.dpichecker.form.step2')}>
          <PopPicker
            location={location}
            onLocation={setLocation}
            selected={selected}
            onSelected={setSelected}
            onPops={onPops}
          />
        </Step>
      )}
      {hasTargets && popIds.length > 0 && (
        <Step title={t('admin.dpichecker.form.step3')}>
          <TotalStep
            checkType={checkType}
            pops={popIds.length}
            resources={chosen.length}
            estimate={quoteReady ? estimate.data : undefined}
            estimating={currentPriceKey !== priceKey || estimate.isFetching}
            balance={balance}
            probeMode={probeMode}
            onProbeMode={setProbeMode}
            runMode={runMode}
            onRunMode={setRunMode}
            schedule={schedule}
            onSchedule={setSchedule}
          />
          {estimate.isError && (
            <p className="text-sm text-error-400">
              {getApiErrorMessage(estimate.error, t('admin.dpichecker.form.estimateFailed'))}
            </p>
          )}
          {launch.isError && (
            <p className="text-sm text-error-400">
              {getApiErrorMessage(launch.error, t('admin.dpichecker.form.failed'))}
            </p>
          )}
          <div className="flex flex-col gap-2 sm:flex-row">
            {!confirming && (
              <button
                type="button"
                className="btn-primary min-h-[44px] px-5 text-sm"
                disabled={!payable || launch.isPending}
                onClick={() => void startPay()}
              >
                {runMode === 'schedule'
                  ? t('admin.dpichecker.form.createMonitor')
                  : t('admin.dpichecker.form.pay')}
              </button>
            )}
            {confirming && (
              <>
                <button
                  type="button"
                  className="btn-primary min-h-[44px] px-5 text-sm"
                  disabled={
                    !payable ||
                    launch.isPending ||
                    !confirmation ||
                    confirmation.key !== approvalKey
                  }
                  onClick={() => {
                    if (confirmation) submitApproved(confirmation);
                  }}
                >
                  {confirmLabel}
                </button>
                <button
                  type="button"
                  className="btn-ghost min-h-[44px] px-4 text-sm"
                  disabled={launch.isPending}
                  onClick={() => setConfirmation(null)}
                >
                  {t('admin.dpichecker.form.cancel')}
                </button>
              </>
            )}
            {short && (
              <button
                type="button"
                className="btn-secondary min-h-[44px] px-4 text-sm"
                onClick={() => openLink(TOPUP_URL)}
              >
                {t('admin.dpichecker.header.topup')}
              </button>
            )}
          </div>
        </Step>
      )}
    </div>
  );
}
