import { queryOptions } from '@tanstack/react-query';
import { adminUsersApi } from '../api/adminUsers';

export function adminUsersQueryOptions(params: Parameters<typeof adminUsersApi.getUsers>[0]) {
  return queryOptions({
    queryKey: ['admin-users', params],
    queryFn: ({ signal }) => adminUsersApi.getUsers(params, signal),
  });
}
