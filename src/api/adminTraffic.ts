import apiClient from './client';

export interface TrafficNodeInfo {
  node_uuid: string;
  node_name: string;
  country_code: string;
}

export interface UserTrafficItem {
  user_id: number;
  telegram_id: number | null;
  username: string | null;
  email: string | null;
  full_name: string;
  tariff_name: string | null;
  subscription_status: string | null;
  traffic_limit_gb: number;
  device_limit: number;
  node_traffic: Record<string, number>;
  total_bytes: number;
}

export interface TrafficNodesResponse {
  nodes: { uuid: string; name: string; country_code: string | null }[];
}

export type TrafficTopParams = (
  | { period: number; start_date?: never; end_date?: never }
  | { period?: never; start_date: string; end_date: string }
) & { node_uuids: string[] | null };

export interface TrafficTopItem {
  rank: number;
  panel_user_id: number;
  panel_username: string;
  total_bytes: number;
  mapping_status: 'matched' | 'unmapped' | 'ambiguous';
  local_user: { id: number; display_name: string } | null;
}

export interface TrafficTopResponse {
  scope: { kind: 'all' | 'selected'; node_uuids: string[]; node_count: number };
  range: { start_date: string; end_date: string; days: number; timezone: 'UTC' };
  top_limit: 100;
  returned_count: number;
  all_recorded_total_bytes: number;
  top_sum_bytes: number;
  daily: { date: string; total_bytes: number }[];
  items: TrafficTopItem[];
  generated_at: string;
}

export const adminTrafficApi = {
  getNodes: async (signal?: AbortSignal): Promise<TrafficNodesResponse> => {
    const response = await apiClient.get('/cabinet/admin/traffic/nodes', { signal });
    return response.data;
  },
  getTop: async (params: TrafficTopParams, signal?: AbortSignal): Promise<TrafficTopResponse> => {
    const response = await apiClient.post('/cabinet/admin/traffic/top', params, { signal });
    return response.data;
  },
};
