import { create } from 'zustand';
import apiClient from '../api/client';
import { getSessionGeneration, isCurrentSession } from '../utils/session';

interface PermissionsResponse {
  permissions: string[];
  roles: string[];
  role_level: number;
}

/**
 * Match a user permission against a required permission.
 *
 * - `*:*` matches everything
 * - `users:*` matches `users:read`, `users:edit`, etc.
 * - Exact match otherwise
 */
function permissionMatches(userPerm: string, required: string): boolean {
  if (userPerm === '*:*') return true;

  if (userPerm.endsWith(':*')) {
    const colonIdx = userPerm.indexOf(':');
    const requiredColonIdx = required.indexOf(':');
    if (colonIdx === -1 || requiredColonIdx === -1) return false;
    const section = userPerm.slice(0, colonIdx);
    const requiredSection = required.slice(0, requiredColonIdx);
    return section === requiredSection;
  }

  return userPerm === required;
}

interface PermissionState {
  permissions: string[];
  roles: string[];
  roleLevel: number;
  isLoaded: boolean;

  fetchPermissions: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (...permissions: string[]) => boolean;
  hasAllPermissions: (...permissions: string[]) => boolean;
  canManageRole: (level: number) => boolean;
  reset: () => void;
}

export const usePermissionStore = create<PermissionState>((set, get) => ({
  permissions: [],
  roles: [],
  roleLevel: 0,
  isLoaded: false,

  fetchPermissions: async () => {
    const owner = getSessionGeneration();
    try {
      const response = await apiClient.get<PermissionsResponse>('/cabinet/auth/me/permissions');
      if (!isCurrentSession(owner)) return;
      set({
        permissions: response.data.permissions,
        roles: response.data.roles,
        roleLevel: response.data.role_level,
        isLoaded: true,
      });
    } catch {
      if (!isCurrentSession(owner)) return;
      set({
        permissions: [],
        roles: [],
        roleLevel: 0,
        isLoaded: true,
      });
    }
  },

  hasPermission: (permission: string): boolean => {
    const { permissions } = get();
    return permissions.some((userPerm) => permissionMatches(userPerm, permission));
  },

  hasAnyPermission: (...permissions: string[]): boolean => {
    const { hasPermission } = get();
    return permissions.some((perm) => hasPermission(perm));
  },

  hasAllPermissions: (...permissions: string[]): boolean => {
    const { hasPermission } = get();
    return permissions.every((perm) => hasPermission(perm));
  },

  canManageRole: (level: number): boolean => {
    const { roleLevel } = get();
    return roleLevel > level;
  },

  reset: () => {
    set({
      permissions: [],
      roles: [],
      roleLevel: 0,
      isLoaded: false,
    });
  },
}));
