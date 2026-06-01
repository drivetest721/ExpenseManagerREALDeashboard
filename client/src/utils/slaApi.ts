/**
 * SLA API wrappers — Admin/Owner only endpoints.
 */
import { apiClient } from './apiClient';

export interface SLAEvent {
  event_id: string;
  reimbursement_id: string;
  reimbursement_code?: string;
  initiator_name?: string;
  reimbursement_status?: string;
  event_type: 'REVIEW_PENDING' | 'QUERY_RESPONSE_PENDING';
  reviewer_id?: string;
  due_at: string;
  is_resolved: boolean;
  reminder_sent: boolean;
  resolve_reason?: string;
  created_at: string;
}

export interface SLAEventsResponse {
  success: boolean;
  total: number;
  items: SLAEvent[];
}

export interface SLARunResponse {
  success: boolean;
  reminders_sent: number;
  auto_rejected: number;
  errors: number;
  message?: string;
}

/**
 * GET /api/sla/events
 * List SLA events (admin).
 */
export const listSLAEventsApi = async (params?: {
  resolved?: boolean;
  event_type?: string;
  limit?: number;
}): Promise<SLAEventsResponse> => {
  const objResp = await apiClient.get<SLAEventsResponse>('/api/sla/events', { params });
  return objResp.data;
};

/**
 * POST /api/sla/run
 * Manually trigger SLA check.
 */
export const runSLACheckApi = async (): Promise<SLARunResponse> => {
  const objResp = await apiClient.post<SLARunResponse>('/api/sla/run');
  return objResp.data;
};

/**
 * GET /api/sla/overdue-count
 * Quick badge count of overdue events.
 */
export const getSLAOverdueCountApi = async (): Promise<number> => {
  const objResp = await apiClient.get<{ success: boolean; count: number }>('/api/sla/overdue-count');
  return objResp.data.count ?? 0;
};
