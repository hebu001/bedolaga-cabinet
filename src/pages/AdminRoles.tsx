import { rbacApi } from '@/api/rbac';
import {
BackIcon,
EditIcon,
PlusIcon,
ShieldIcon,
TrashIcon,
} from '@/components/admin/legacyPageIcons/AdminRoles';
import { PermissionGate } from '@/components/auth/PermissionGate';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { usePlatform } from '@/platform/hooks/usePlatform';
import { usePermissionStore } from '@/store/permissions';
import { useMutation,useQuery,useQueryClient } from '@tanstack/react-query';
import { useMemo,useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import { Skeleton,SkeletonGroup } from '@/components/ui/skeleton';

export default function AdminRoles() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { capabilities } = usePlatform();
  const canManageRole = usePermissionStore((s) => s.canManageRole);

  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const deleteDialogRef = useFocusTrap<HTMLDivElement>(deleteConfirm !== null, {
    onEscape: () => setDeleteConfirm(null),
  });

  // Queries
  const {
    data: roles,
    isLoading: rolesLoading,
    error: rolesError,
  } = useQuery({
    queryKey: ['admin-roles'],
    queryFn: rbacApi.getRoles,
  });

  // Mutations
  const deleteMutation = useMutation({
    mutationFn: rbacApi.deleteRole,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-roles'] });
      setDeleteConfirm(null);
    },
    onError: () => {
      setDeleteConfirm(null);
      setFormError(t('admin.roles.errors.deleteFailed'));
    },
  });

  // Sorted roles by level descending
  const sortedRoles = useMemo(() => {
    if (!roles) return [];
    return [...roles].sort((a, b) => b.level - a.level);
  }, [roles]);

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          {!capabilities.hasBackButton && (
            <button
              onClick={() => navigate('/admin')}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-apple-elevated transition-opacity hover:opacity-90"
            >
              <BackIcon />
            </button>
          )}
          <div>
            <h1 className="text-xl font-semibold text-apple-ink">{t('admin.roles.title')}</h1>
            <p className="text-sm text-apple-mute">{t('admin.roles.subtitle')}</p>
          </div>
        </div>
        <PermissionGate permission="roles:create">
          <button
            onClick={() => navigate('/admin/roles/create')}
            className="flex items-center justify-center gap-2 rounded-full bg-[#F97315] px-4 py-2 text-white transition-opacity hover:opacity-90"
          >
            <PlusIcon />
            {t('admin.roles.createRole')}
          </button>
        </PermissionGate>
      </div>

      {/* Error message */}
      {formError && (
        <div className="mb-4 rounded-xl bg-apple-red/10 p-3">
          <p className="text-sm text-apple-red">{formError}</p>
        </div>
      )}

      {/* Stats Overview */}
      {sortedRoles.length > 0 && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="apple-card-grad rounded-2xl bg-apple-card p-4">
            <div className="text-2xl font-bold text-apple-ink">{sortedRoles.length}</div>
            <div className="text-xs text-apple-mute">{t('admin.roles.stats.totalRoles')}</div>
          </div>
          <div className="apple-card-grad rounded-2xl bg-apple-card p-4">
            <div className="text-2xl font-bold" style={{ color: '#F97315' }}>
              {sortedRoles.filter((r) => r.is_active).length}
            </div>
            <div className="text-xs text-apple-mute">{t('admin.roles.stats.active')}</div>
          </div>
          <div className="apple-card-grad rounded-2xl bg-apple-card p-4">
            <div className="text-2xl font-bold text-apple-amber">
              {sortedRoles.filter((r) => r.is_system).length}
            </div>
            <div className="text-xs text-apple-mute">{t('admin.roles.stats.system')}</div>
          </div>
        </div>
      )}

      {/* Roles List */}
      {rolesLoading ? (
        <SkeletonGroup className="space-y-3">
          <Skeleton variant="card" count={3} className="h-16" />
        </SkeletonGroup>
      ) : rolesError ? (
        <div className="py-12 text-center">
          <p className="text-apple-red">{t('admin.roles.errors.loadFailed')}</p>
        </div>
      ) : sortedRoles.length === 0 ? (
        <div className="py-12 text-center">
          <ShieldIcon />
          <p className="mt-2 text-apple-mute">{t('admin.roles.noRoles')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedRoles.map((role) => (
            <div
              key={role.id}
              className={`apple-card-grad rounded-2xl bg-apple-card p-4 ${
                role.is_active ? '' : 'opacity-60'
              }`}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <div className="min-w-0 flex-1">
                  {/* Role name with color badge */}
                  <div className="mb-2 flex items-center gap-2">
                    <span
                      className="inline-block h-3 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: role.color || '#6b7280' }}
                      aria-hidden="true"
                    />
                    <span className="font-medium text-apple-ink">{role.name}</span>
                    {role.is_system && (
                      <span className="rounded-full bg-apple-amber/15 px-2.5 py-1 text-[11px] font-semibold text-apple-amber">
                        {t('admin.roles.systemBadge')}
                      </span>
                    )}
                    {!role.is_active && (
                      <span className="rounded-full bg-apple-elevated px-2.5 py-1 text-[11px] font-semibold text-apple-mute">
                        {t('admin.roles.inactiveBadge')}
                      </span>
                    )}
                  </div>
                  {/* Info */}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-apple-mute">
                    <span>
                      {t('admin.roles.levelLabel')}: {role.level}
                    </span>
                    {role.description && <span>{role.description}</span>}
                    <span>{t('admin.roles.usersCount', { count: role.user_count ?? 0 })}</span>
                    <span>
                      {t('admin.roles.permissionsCount', {
                        count: role.permissions.length,
                      })}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 border-t border-apple-hairline pt-3 sm:border-0 sm:pt-0">
                  <PermissionGate permission="roles:edit">
                    <button
                      onClick={() => navigate(`/admin/roles/${role.id}/edit`)}
                      disabled={!canManageRole(role.level)}
                      className="flex-1 rounded-xl bg-apple-elevated p-2 text-apple-mute transition-colors hover:text-apple-ink disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none"
                      title={t('admin.roles.actions.edit')}
                    >
                      <EditIcon />
                    </button>
                  </PermissionGate>
                  <PermissionGate permission="roles:delete">
                    <button
                      onClick={() => setDeleteConfirm(role.id)}
                      disabled={role.is_system || !canManageRole(role.level)}
                      className="flex-1 rounded-xl bg-apple-elevated p-2 text-apple-mute transition-colors hover:bg-apple-red/15 hover:text-apple-red disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none"
                      title={t('admin.roles.actions.delete')}
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </PermissionGate>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteConfirm !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-dark-950/60"
            onClick={() => setDeleteConfirm(null)}
            aria-hidden="true"
          />
          <div
            ref={deleteDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="role-delete-title"
            tabIndex={-1}
            className="apple-card-grad relative w-full max-w-sm rounded-2xl bg-apple-card p-6"
          >
            <h3 id="role-delete-title" className="mb-2 text-lg font-semibold text-apple-ink">
              {t('admin.roles.confirm.title')}
            </h3>
            <p className="mb-6 text-apple-mute">{t('admin.roles.confirm.text')}</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 text-apple-mute transition-colors hover:text-apple-ink"
              >
                {t('admin.roles.confirm.cancel')}
              </button>
              <button
                onClick={() => deleteMutation.mutate(deleteConfirm)}
                disabled={deleteMutation.isPending}
                className="rounded-full bg-apple-red px-4 py-2 text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {deleteMutation.isPending
                  ? t('admin.roles.confirm.deleting')
                  : t('admin.roles.confirm.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
