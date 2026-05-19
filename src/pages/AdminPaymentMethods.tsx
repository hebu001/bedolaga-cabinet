import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { usePlatform } from '../platform/hooks/usePlatform';
import { useNotify } from '../platform/hooks/useNotify';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';

import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { adminPaymentMethodsApi } from '../api/adminPaymentMethods';
import type { PaymentMethodConfig } from '../types';
const BackIcon = () => (
  <svg
    className="h-5 w-5 text-apple-mute"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
  </svg>
);

const GripIcon = () => (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
    />
  </svg>
);

const ChevronRightIcon = () => (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
  </svg>
);

const SaveIcon = () => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
    />
  </svg>
);

interface SortableCardProps {
  config: PaymentMethodConfig;
  onClick: () => void;
}

function SortablePaymentCard({ config, onClick }: SortableCardProps) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: config.method_id,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    position: isDragging ? 'relative' : undefined,
  };

  const displayName = config.display_name || config.default_display_name;

  // Build condition summary chips
  const chips: string[] = [];
  if (config.user_type_filter === 'telegram')
    chips.push(t('admin.paymentMethods.userTypeTelegram'));
  if (config.user_type_filter === 'email') chips.push(t('admin.paymentMethods.userTypeEmail'));
  if (config.first_topup_filter === 'yes') chips.push(t('admin.paymentMethods.firstTopupYes'));
  if (config.first_topup_filter === 'no') chips.push(t('admin.paymentMethods.firstTopupNo'));
  if (config.promo_group_filter_mode === 'selected' && config.allowed_promo_group_ids.length > 0) {
    chips.push(
      `${config.allowed_promo_group_ids.length} ${t('admin.paymentMethods.promoGroupsShort')}`,
    );
  }

  // Count enabled sub-options
  let subOptionsInfo = '';
  if (config.available_sub_options && config.sub_options) {
    const enabledCount = config.available_sub_options.filter(
      (o) => config.sub_options?.[o.id] !== false,
    ).length;
    const totalCount = config.available_sub_options.length;
    if (enabledCount < totalCount) {
      subOptionsInfo = `${enabledCount}/${totalCount}`;
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex items-center gap-3 rounded-2xl p-4 ${
        isDragging
          ? 'bg-apple-elevated shadow-xl shadow-[#F97315]/20'
          : config.is_enabled
            ? 'bg-apple-elevated'
            : 'bg-apple-elevated opacity-60'
      }`}
    >
      {/* Drag handle */}
      {/* Drag handle - larger touch target for mobile */}
      <button
        {...attributes}
        {...listeners}
        className="flex-shrink-0 cursor-grab touch-none rounded-lg p-2.5 text-apple-faint hover:text-apple-mute active:cursor-grabbing sm:p-1.5"
        title={t('admin.paymentMethods.dragToReorder')}
      >
        <GripIcon />
      </button>

      {/* Content */}
      <div className="min-w-0 flex-1 cursor-pointer" onClick={onClick}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate font-semibold text-apple-ink">{displayName}</span>
          {config.is_enabled ? (
            <span className="flex-shrink-0 rounded-full bg-apple-green/15 px-2.5 py-1 text-[11px] font-semibold text-apple-green">
              {t('admin.paymentMethods.enabled')}
            </span>
          ) : (
            <span className="flex-shrink-0 rounded-full bg-apple-elevated px-2.5 py-1 text-[11px] font-semibold text-apple-mute">
              {t('admin.paymentMethods.disabled')}
            </span>
          )}
          {!config.is_provider_configured && (
            <span className="flex-shrink-0 rounded-full bg-apple-amber/15 px-2.5 py-1 text-[11px] font-semibold text-apple-amber">
              {t('admin.paymentMethods.notConfigured')}
            </span>
          )}
          {subOptionsInfo && (
            <span className="flex-shrink-0 rounded-full bg-apple-elevated px-2.5 py-1 text-[11px] font-semibold text-apple-mute">
              {subOptionsInfo}
            </span>
          )}
        </div>

        {/* Condition chips */}
        {chips.length > 0 && (
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {chips.map((chip, i) => (
              <span
                key={i}
                className="rounded-full bg-[#F97315]/10 px-2.5 py-1 text-[11px] font-semibold"
                style={{ color: '#F97315' }}
              >
                {chip}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Chevron */}
      <button
        onClick={onClick}
        className="flex-shrink-0 p-1 text-apple-faint transition-colors hover:text-apple-mute"
      >
        <ChevronRightIcon />
      </button>
    </div>
  );
}

export default function AdminPaymentMethods() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { capabilities } = usePlatform();

  const notify = useNotify();
  const [methods, setMethods] = useState<PaymentMethodConfig[]>([]);
  const [orderChanged, setOrderChanged] = useState(false);

  // Fetch payment methods
  const { data: fetchedMethods, isLoading } = useQuery({
    queryKey: ['admin-payment-methods'],
    queryFn: adminPaymentMethodsApi.getAll,
  });

  // Sync fetched data to local state
  useEffect(() => {
    if (fetchedMethods && !orderChanged) {
      setMethods(fetchedMethods);
    }
  }, [fetchedMethods, orderChanged]);

  // Save order mutation
  const saveOrderMutation = useMutation({
    mutationFn: (methodIds: string[]) => adminPaymentMethodsApi.updateOrder(methodIds),
    onSuccess: () => {
      setOrderChanged(false);
      queryClient.invalidateQueries({ queryKey: ['admin-payment-methods'] });
      notify.success(t('admin.paymentMethods.orderSaved'));
    },
    onError: () => {
      notify.error(t('common.error'));
    },
  });

  // DnD sensors - PointerSensor handles both mouse and touch
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setMethods((prev) => {
        const oldIndex = prev.findIndex((m) => m.method_id === active.id);
        const newIndex = prev.findIndex((m) => m.method_id === over.id);
        if (oldIndex === -1 || newIndex === -1) return prev;
        return arrayMove(prev, oldIndex, newIndex);
      });
      setOrderChanged(true);
    }
  }, []);

  const handleSaveOrder = () => {
    saveOrderMutation.mutate(methods.map((m) => m.method_id));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {/* Show back button only on web, not in Telegram Mini App */}
          {!capabilities.hasBackButton && (
            <button
              onClick={() => navigate('/admin')}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-apple-card transition-colors hover:bg-apple-elevated"
            >
              <BackIcon />
            </button>
          )}
          <div>
            <h1 className="text-2xl font-bold text-apple-ink">{t('admin.paymentMethods.title')}</h1>
            <p className="text-sm text-apple-mute">{t('admin.paymentMethods.description')}</p>
          </div>
        </div>
        {orderChanged && (
          <button
            onClick={handleSaveOrder}
            disabled={saveOrderMutation.isPending}
            className="flex items-center gap-2 rounded-full bg-[#F97315] px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {saveOrderMutation.isPending ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            ) : (
              <SaveIcon />
            )}
            {t('admin.paymentMethods.saveOrder')}
          </button>
        )}
      </div>

      {/* Drag hint */}
      <div className="flex items-center gap-2 text-sm text-apple-faint">
        <GripIcon />
        {t('admin.paymentMethods.dragHint')}
      </div>

      {/* Methods list */}
      <div className="apple-card-grad rounded-2xl bg-apple-card p-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#F97315] border-t-transparent" />
          </div>
        ) : methods.length > 0 ? (
          <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
            <SortableContext
              items={methods.map((m) => m.method_id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {methods.map((config) => (
                  <SortablePaymentCard
                    key={config.method_id}
                    config={config}
                    onClick={() => navigate(`/admin/payment-methods/${config.method_id}/edit`)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        ) : (
          <div className="py-12 text-center">
            <div className="text-apple-mute">{t('admin.paymentMethods.noMethods')}</div>
          </div>
        )}
      </div>
    </div>
  );
}
