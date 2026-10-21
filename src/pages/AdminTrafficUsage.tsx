import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { backTo } from '@/components/admin';
import {
  adminTrafficApi,
  type TrafficTopParams,
  type TrafficTopResponse,
} from '@/api/adminTraffic';
import { usePlatform } from '@/platform/hooks/usePlatform';
import { PeriodSelector } from '@/components/admin/trafficUsage/filters/PeriodSelector';
import { NodeFilter } from '@/components/admin/trafficUsage/filters/NodeFilter';
import { CountryFilter } from '@/components/admin/trafficUsage/filters/CountryFilter';
import { formatBytes } from '@/components/admin/trafficUsage/trafficUsageHelpers';
import {
  filterTrafficTop,
  isValidTrafficRange,
  resolveTrafficNodes,
  utcPeriodRange,
  type TrafficTopSort,
} from '@/components/admin/trafficUsage/trafficTopHelpers';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  RefreshIcon,
  SearchIcon,
  SortIcon,
} from '@/components/admin/trafficUsage/TrafficIcons';

const QUERY_POLICY = {
  staleTime: 5 * 60 * 1000,
  gcTime: 5 * 60 * 1000,
  retry: false,
  retryOnMount: false,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
} as const;

function TrafficDailyChart({ daily }: { daily: TrafficTopResponse['daily'] }) {
  const { t } = useTranslation();
  const peak = Math.max(1, ...daily.map((day) => day.total_bytes));
  return (
    <div className="apple-card-grad rounded-2xl bg-apple-card p-4">
      <h2 className="mb-4 text-sm font-medium text-apple-ink">
        {t('admin.trafficUsage.top100.daily')}
      </h2>
      <div
        className="flex h-40 items-end gap-1"
        role="img"
        aria-label={t('admin.trafficUsage.top100.daily')}
      >
        {daily.map((day) => (
          <div
            key={day.date}
            className="group relative flex h-full min-w-0 flex-1 items-end"
            tabIndex={0}
            aria-label={`${day.date} UTC: ${formatBytes(day.total_bytes)}`}
            title={`${day.date} UTC: ${formatBytes(day.total_bytes)}`}
          >
            <div
              className="w-full rounded-t bg-[#F97315]/80 transition-colors group-hover:bg-[#F97315] group-focus:bg-[#F97315]"
              style={{
                height: `${(day.total_bytes / peak) * 100}%`,
                minHeight: day.total_bytes > 0 ? 2 : 0,
              }}
            />
            <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-apple-elevated px-2 py-1 text-xs text-apple-ink shadow-lg group-hover:block group-focus:block">
              {day.date} · {formatBytes(day.total_bytes)}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-apple-faint">
        <span>{daily[0]?.date}</span>
        <span>UTC</span>
        <span>{daily.length > 1 ? daily[daily.length - 1]?.date : ''}</span>
      </div>
    </div>
  );
}

export default function AdminTrafficUsage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { capabilities } = usePlatform();
  const [period, setPeriod] = useState(7);
  const [dateMode, setDateMode] = useState(false);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [appliedDates, setAppliedDates] = useState<{ start_date: string; end_date: string } | null>(
    null,
  );
  const [selectedNodes, setSelectedNodes] = useState<Set<string>>(new Set());
  const [selectedCountries, setSelectedCountries] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<TrafficTopSort>({ field: 'rank', descending: false });
  const [page, setPage] = useState(0);

  const nodesQuery = useQuery({
    queryKey: ['admin-traffic-nodes'],
    queryFn: ({ signal }) => adminTrafficApi.getNodes(signal),
    ...QUERY_POLICY,
  });
  const nodes = useMemo(
    () =>
      nodesQuery.data?.nodes.map((node) => ({
        node_uuid: node.uuid,
        node_name: node.name,
        country_code: node.country_code ?? '',
      })) ?? [],
    [nodesQuery.data],
  );
  const nodeUuids = useMemo(
    () => resolveTrafficNodes(nodes, selectedNodes, selectedCountries),
    [nodes, selectedNodes, selectedCountries],
  );
  const emptySelection = nodeUuids !== null && nodeUuids.length === 0;
  const countries = useMemo(() => {
    const counts = new Map<string, number>();
    for (const node of nodes)
      if (node.country_code)
        counts.set(node.country_code, (counts.get(node.country_code) ?? 0) + 1);
    return [...counts]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([code, count]) => ({ code, count }));
  }, [nodes]);

  const params = useMemo<TrafficTopParams>(
    () => ({ ...(appliedDates ?? { period }), node_uuids: nodeUuids }),
    [appliedDates, period, nodeUuids],
  );
  const canRequest = nodesQuery.isSuccess && !emptySelection;
  const reportQuery = useQuery({
    queryKey: ['admin-traffic-top', params],
    queryFn: ({ signal }) => adminTrafficApi.getTop(params, signal),
    enabled: canRequest,
    ...QUERY_POLICY,
  });
  // Metadata, chart and rows always come from the same completed response.
  // Changing scope never leaves rows from the previous scope on screen.
  const report = canRequest ? reportQuery.data : undefined;
  const loading = nodesQuery.isFetching || (canRequest && reportQuery.isFetching);
  const error = nodesQuery.isError || (canRequest && reportQuery.isError);
  const filtered = useMemo(
    () => filterTrafficTop(report?.items ?? [], search, sort),
    [report, search, sort],
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / 50));
  const visiblePage = Math.min(page, pageCount - 1);
  const visibleItems = filtered.slice(visiblePage * 50, (visiblePage + 1) * 50);
  const peak = report?.daily.reduce(
    (best, day) => (day.total_bytes > best.total_bytes ? day : best),
    { date: '', total_bytes: 0 },
  );
  const scopeLabel = !report
    ? ''
    : report.scope.kind === 'all'
      ? t('admin.trafficUsage.allNodes')
      : report.scope.node_count === 1
        ? (nodes.find((node) => node.node_uuid === report.scope.node_uuids[0])?.node_name ??
          t('admin.trafficUsage.top100.selectedNodes', { count: 1 }))
        : t('admin.trafficUsage.top100.selectedNodes', { count: report.scope.node_count });
  const validDraft = isValidTrafficRange(customStart, customEnd);
  const draftChanged =
    dateMode && (customStart !== appliedDates?.start_date || customEnd !== appliedDates?.end_date);

  const changePeriod = (next: number) => {
    setPeriod(next);
    setAppliedDates(null);
    setPage(0);
  };
  const toggleDates = () => {
    if (dateMode) {
      setDateMode(false);
      setAppliedDates(null);
      setPage(0);
    } else {
      const range = appliedDates ?? utcPeriodRange(period);
      setCustomStart(range.start_date);
      setCustomEnd(range.end_date);
      setDateMode(true);
    }
  };
  const refresh = () => {
    if (nodesQuery.isError) void nodesQuery.refetch();
    else if (canRequest) void reportQuery.refetch();
  };
  const toggleSort = (field: TrafficTopSort['field']) => {
    setSort((previous) => ({
      field,
      descending: previous.field === field ? !previous.descending : field === 'traffic',
    }));
    setPage(0);
  };
  const sortHeader = (field: TrafficTopSort['field'], label: string) => (
    <button
      onClick={() => toggleSort(field)}
      className="inline-flex items-center gap-1 hover:text-apple-ink"
    >
      {label}
      <SortIcon direction={sort.field === field ? (sort.descending ? 'desc' : 'asc') : false} />
    </button>
  );

  return (
    <div className="relative animate-fade-in">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 basis-48 items-center gap-3">
          {!capabilities.hasBackButton && (
            <button
              onClick={() => navigate('/admin')}
              aria-label={t('common.back')}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-apple-card transition-colors hover:bg-apple-elevated"
            >
              <ChevronLeftIcon />
            </button>
          )}
          <div>
            <h1 className="text-xl font-bold text-apple-ink">{t('admin.trafficUsage.title')}</h1>
            <p className="text-sm text-apple-mute">{t('admin.trafficUsage.top100.subtitle')}</p>
          </div>
        </div>
        <button
          onClick={refresh}
          disabled={loading || (!nodesQuery.isError && !canRequest)}
          aria-label={t('common.refresh')}
          className="rounded-lg p-2 transition-colors hover:bg-apple-elevated disabled:opacity-50"
        >
          <RefreshIcon className={loading ? 'animate-spin' : ''} />
        </button>
      </div>
      <div className="relative mb-4 flex flex-wrap items-center gap-3">
        <PeriodSelector
          value={period}
          onChange={changePeriod}
          label={t('admin.trafficUsage.period')}
          dateMode={dateMode}
          customStart={customStart}
          customEnd={customEnd}
          onToggleDateMode={toggleDates}
          onCustomStartChange={setCustomStart}
          onCustomEndChange={setCustomEnd}
        />
        {dateMode && (
          <button
            onClick={() => {
              if (validDraft) {
                setAppliedDates({ start_date: customStart, end_date: customEnd });
                setPage(0);
              }
            }}
            disabled={!validDraft || !draftChanged}
            className="rounded-lg bg-[#F97315] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
          >
            {t('admin.trafficUsage.top100.applyDates')}
          </button>
        )}
        <NodeFilter
          available={nodes}
          selected={selectedNodes}
          onChange={(value) => {
            setSelectedNodes(value);
            setPage(0);
          }}
        />
        <CountryFilter
          available={countries}
          selected={selectedCountries}
          onChange={(value) => {
            setSelectedCountries(value);
            setPage(0);
          }}
        />
      </div>
      {dateMode && (
        <p className={`mb-4 text-xs ${validDraft ? 'text-apple-mute' : 'text-apple-red'}`}>
          {t('admin.trafficUsage.top100.dateHint')}
        </p>
      )}
      {error && (
        <div
          role="alert"
          className="mb-4 rounded-xl bg-apple-red/10 px-4 py-3 text-sm text-apple-red"
        >
          {t(report ? 'common.staleData' : 'common.loadError')}
        </div>
      )}
      {emptySelection && nodesQuery.isSuccess && (
        <p role="status" className="rounded-xl bg-apple-card p-4 text-sm text-apple-mute">
          {t('admin.trafficUsage.top100.emptySelection')}
        </p>
      )}
      {loading && !report && (
        <p role="status" className="py-12 text-center text-sm text-apple-mute">
          {t('admin.trafficUsage.loading')}
        </p>
      )}
      {report && (
        <section aria-busy={loading}>
          <div className="mb-4 text-sm text-apple-mute" data-testid="traffic-scope">
            <span className="font-medium text-apple-ink">{scopeLabel}</span>
            <span className="mx-2">·</span>
            {report.range.start_date} — {report.range.end_date} · UTC
          </div>
          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { key: 'allTraffic', value: formatBytes(report.all_recorded_total_bytes) },
              {
                key: 'averageDaily',
                value: formatBytes(report.all_recorded_total_bytes / report.range.days),
              },
              { key: 'peakDaily', value: formatBytes(peak?.total_bytes ?? 0), note: peak?.date },
              { key: 'topTraffic', value: formatBytes(report.top_sum_bytes) },
            ].map((stat) => (
              <div
                key={stat.key}
                className="apple-card-grad rounded-2xl bg-apple-card p-4"
                data-testid={`traffic-${stat.key}`}
              >
                <p className="mb-1 text-xs text-apple-mute">
                  {t(`admin.trafficUsage.top100.${stat.key}`)}
                </p>
                <p className="text-xl font-semibold text-apple-ink">{stat.value}</p>
                {stat.note && <p className="mt-1 text-[10px] text-apple-faint">{stat.note} UTC</p>}
              </div>
            ))}
          </div>
          <TrafficDailyChart daily={report.daily} />
          <div className="mb-3 mt-6">
            <h2 className="text-lg font-semibold text-apple-ink">
              {t('admin.trafficUsage.top100.title')}
            </h2>
            <p className="mt-1 text-xs text-apple-mute">
              {t('admin.trafficUsage.top100.description')}
            </p>
            <p className="mt-1 text-xs text-apple-mute">
              {t('admin.trafficUsage.top100.accountCount', {
                count: report.returned_count,
                limit: report.top_limit,
              })}
            </p>
          </div>
          <div className="relative mb-3">
            <input
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(0);
              }}
              placeholder={t('admin.trafficUsage.top100.search')}
              aria-label={t('admin.trafficUsage.top100.search')}
              className="w-full rounded-xl bg-apple-elevated py-3 pl-10 pr-4 text-[15px] text-apple-ink outline-none placeholder:text-apple-faint focus:ring-2 focus:ring-[#F97315]/50"
            />
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-apple-faint">
              <SearchIcon />
            </div>
          </div>
          <p className="mb-3 text-xs text-apple-faint">
            {search.trim()
              ? t('admin.trafficUsage.top100.matches', {
                  count: filtered.length,
                  total: report.returned_count,
                })
              : t('admin.trafficUsage.top100.localSort')}
          </p>
          {visibleItems.length === 0 ? (
            <p className="py-10 text-center text-apple-mute">
              {t(
                search.trim()
                  ? 'admin.trafficUsage.top100.noMatches'
                  : 'admin.trafficUsage.top100.noAccounts',
              )}
            </p>
          ) : (
            <div className="apple-card-grad overflow-x-auto rounded-2xl bg-apple-card">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-apple-hairline text-xs text-apple-mute">
                    <th
                      className="w-16 px-3 py-3"
                      aria-sort={
                        sort.field === 'rank'
                          ? sort.descending
                            ? 'descending'
                            : 'ascending'
                          : 'none'
                      }
                    >
                      {sortHeader('rank', t('admin.trafficUsage.top100.rank'))}
                    </th>
                    <th
                      className="px-3 py-3"
                      aria-sort={
                        sort.field === 'name'
                          ? sort.descending
                            ? 'descending'
                            : 'ascending'
                          : 'none'
                      }
                    >
                      {sortHeader('name', t('admin.trafficUsage.top100.account'))}
                    </th>
                    <th
                      className="px-3 py-3 text-right"
                      aria-sort={
                        sort.field === 'traffic'
                          ? sort.descending
                            ? 'descending'
                            : 'ascending'
                          : 'none'
                      }
                    >
                      {sortHeader('traffic', t('admin.trafficUsage.top100.accountTraffic'))}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visibleItems.map((item) => (
                    <tr
                      key={item.panel_user_id}
                      className="border-b border-apple-hairline last:border-0"
                      data-panel-id={item.panel_user_id}
                    >
                      <td className="px-3 py-3 text-apple-mute">{item.rank}</td>
                      <td className="px-3 py-3">
                        {item.mapping_status === 'matched' && item.local_user ? (
                          <Link
                            to={`/admin/users/${item.local_user.id}`}
                            state={backTo(location).state}
                            className="font-medium text-[#F97315] hover:underline"
                          >
                            {item.local_user.display_name || item.panel_username}
                          </Link>
                        ) : (
                          <span className="font-medium text-apple-ink">{item.panel_username}</span>
                        )}
                        {item.local_user && (
                          <div className="text-xs text-apple-mute">{item.panel_username}</div>
                        )}
                        <div className="mt-0.5 text-[10px] text-apple-faint">
                          {t('admin.trafficUsage.top100.panelId', { id: item.panel_user_id })}
                          {item.mapping_status !== 'matched' && (
                            <> · {t(`admin.trafficUsage.top100.${item.mapping_status}`)}</>
                          )}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-right font-medium text-apple-ink">
                        {formatBytes(item.total_bytes)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {pageCount > 1 && (
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                onClick={() => setPage(visiblePage - 1)}
                disabled={visiblePage === 0}
                aria-label={t('admin.trafficUsage.top100.previousPage')}
                className="rounded-lg bg-apple-elevated p-2 disabled:opacity-50"
              >
                <ChevronLeftIcon />
              </button>
              <span className="px-3 text-sm text-apple-mute">
                {visiblePage + 1} / {pageCount}
              </span>
              <button
                onClick={() => setPage(visiblePage + 1)}
                disabled={visiblePage + 1 >= pageCount}
                aria-label={t('admin.trafficUsage.top100.nextPage')}
                className="rounded-lg bg-apple-elevated p-2 disabled:opacity-50"
              >
                <ChevronRightIcon />
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
