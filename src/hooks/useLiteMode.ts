import { integrationCapabilities } from '../config/integrationCapabilities';
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';

import { brandingApi } from '@/api/branding';
import { STORAGE_KEYS } from '@/config/constants';
import { safeLocal } from '@/utils/safeStorage';

export const LITE_MODE_QUERY_KEY = ['lite-mode'] as const;

/**
 * Простой вид — настройка оператора на весь магазин, а не тема пользователя.
 * Она решает, какой экран отрисуется на «/», поэтому нужна ДО ответа сервера:
 * иначе покупатель успевает увидеть полный экран, и тот меняется у него на
 * глазах. Отсюда подсказка прошлого визита в хранилище.
 *
 * Значение читается строго: включает простой вид только дословное 'true'.
 * Мусор в хранилище (чужая запись, недописанное значение) обязан читаться как
 * «выключено» — ошибка в эту сторону всего лишь показывает привычный экран,
 * ошибка в обратную прячет от человека половину кабинета.
 */
export function readLiteModeHint(): boolean {
  return safeLocal.getItem(STORAGE_KEYS.LITE_MODE) === 'true';
}

export function writeLiteModeHint(enabled: boolean): void {
  safeLocal.setItem(STORAGE_KEYS.LITE_MODE, String(enabled));
}

export interface LiteModeState {
  /** Показывать простой вид покупателя. */
  lite: boolean;
  /** Ответ сервера ещё не пришёл: значение взято из подсказки. */
  isLoading: boolean;
}

export function useLiteMode(): LiteModeState {
  const { data, isPending } = useQuery({
    queryKey: LITE_MODE_QUERY_KEY,
    enabled: integrationCapabilities.liteMode,
    queryFn: brandingApi.getLiteModeEnabled,
    staleTime: 60_000,
    retry: false,
  });

  const lite = integrationCapabilities.liteMode && (data ? data.enabled : readLiteModeHint());

  useEffect(() => {
    if (!data) return;
    writeLiteModeHint(data.enabled);
  }, [data]);

  return { lite, isLoading: integrationCapabilities.liteMode && isPending };
}
