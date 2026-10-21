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

export interface TrafficUsageResponse {
  items: UserTrafficItem[];
  nodes: TrafficNodeInfo[];
  total: number;
  offset: number;
  limit: number;
  period_days: number;
  available_tariffs: string[];
  available_statuses: string[];
}

export interface ExportCsvResponse {
  success: boolean;
  message: string;
}

export interface TrafficEnrichmentData {
  devices_connected: number;
  total_spent_kopeks: number;
  subscription_start_date: string | null;
  subscription_end_date: string | null;
  last_node_name: string | null;
}

export interface TrafficEnrichmentResponse {
  data: Record<number, TrafficEnrichmentData>;
}

export type TrafficParams = {
  period?: number;
  limit?: number;
  offset?: number;
  search?: string;
  sort_by?: string;
  sort_desc?: boolean;
  tariffs?: string;
  statuses?: string;
  nodes?: string;
  start_date?: string;
  end_date?: string;
};

export const adminTrafficApi = {
  getTrafficUsage: async (
    params: TrafficParams,
    options?: { signal?: AbortSignal },
  ): Promise<TrafficUsageResponse> => {
    const response = await apiClient.get('/cabinet/admin/traffic', {
      params,
      signal: options?.signal,
    });
    return response.data;
  },

  getEnrichment: async (
    userIds: number[],
    options?: { signal?: AbortSignal },
  ): Promise<TrafficEnrichmentResponse> => {
    // An absent user_ids parameter requests the legacy full dataset. Never
    // accidentally trigger that expensive path for an empty table.
    if (userIds.length === 0) return { data: {} };
    const response = await apiClient.get('/cabinet/admin/traffic/enrichment', {
      params: { user_ids: [...new Set(userIds)].sort((a, b) => a - b).join(',') },
      signal: options?.signal,
    });
    return response.data;
  },

  exportCsv: async (data: {
    period: number;
    start_date?: string;
    end_date?: string;
    tariffs?: string;
    statuses?: string;
    nodes?: string;
    total_threshold_gb?: number;
    node_threshold_gb?: number;
  }): Promise<ExportCsvResponse> => {
    const response = await apiClient.post('/cabinet/admin/traffic/export-csv', data);
    return response.data;
  },
};
