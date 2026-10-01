import { useQuery } from '@tanstack/react-query';
import { dpicheckerApi } from '@/api/dpichecker';
import { integrationCapabilities } from '@/config/integrationCapabilities';
import { usePermissionStore } from '@/store/permissions';

export const DPI_STATUS_KEY = ['dpichecker', 'status'] as const;

/** Статус раздела: включено ли, настроено ли, баланс и квоты. Общий ключ — кнопки на карточках панели тоже его читают. */
export function useDpiStatus() {
  const canRead = usePermissionStore((state) => state.hasPermission('dpichecker:read'));
  return useQuery({
    queryKey: DPI_STATUS_KEY,
    queryFn: dpicheckerApi.getStatus,
    staleTime: 30_000,
    enabled: integrationCapabilities.dpichecker && canRead,
  });
}

/** Раздел включён и с ключом — кнопки «Проверить в DPI//CHECKER» на карточках панели показываются. */
export function useDpiAvailable(): boolean {
  const { data } = useDpiStatus();
  const canRead = usePermissionStore((state) => state.hasPermission('dpichecker:read'));
  return Boolean(
    integrationCapabilities.dpichecker && canRead && data?.enabled && data?.configured,
  );
}
