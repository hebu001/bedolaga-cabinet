import { useQuery, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '@/api/admin';

/** Shared signed-media snapshot for both admin ticket screens. A mutation must
 * cancel an older GET before fetching its new snapshot; media renewal may share
 * a current GET, but must never hide a freshly sent reply or status update. */
export function useAdminTicketDetail(ticketId: number | null) {
  const client = useQueryClient();
  const queryKey = ['admin-ticket', ticketId] as const;
  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => adminApi.getTicket(ticketId!, signal),
    enabled: ticketId !== null,
  });
  const refreshAfterMutation = async () => {
    await client.cancelQueries({ queryKey, exact: true });
    return query.refetch({ cancelRefetch: true, throwOnError: true });
  };
  const refreshMedia = () => query.refetch({ cancelRefetch: false, throwOnError: true });
  return { ...query, refreshAfterMutation, refreshMedia };
}
