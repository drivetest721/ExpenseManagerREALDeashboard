/**
 * reimbursementApi.ts — Axios wrappers for Reimbursement endpoints.
 */
import { apiClient } from './apiClient';
import type {
  Reimbursement,
  ReimbursementListItem,
  ReimbursementCreateRequest,
  ReimbursementUpdateRequest,
} from '../types/reimbursement';
import type { ActivityLog } from '../types/activityLog';

export type {
  Reimbursement,
  ReimbursementListItem,
  ReimbursementCreateRequest,
  ReimbursementUpdateRequest,
} from '../types/reimbursement';

/**
 * POST /api/reimbursements/draft
 * Create a new reimbursement in DRAFT status.
 */
export const createDraftApi = async (objPayload: ReimbursementCreateRequest): Promise<Reimbursement> => {
  const objResp = await apiClient.post<Reimbursement>('/api/reimbursements/draft', objPayload);
  return objResp.data;
};

/**
 * PUT /api/reimbursements/:id/draft
 * Update an existing draft.
 */
export const updateDraftApi = async (strId: string, objPayload: ReimbursementUpdateRequest): Promise<Reimbursement> => {
  const objResp = await apiClient.put<Reimbursement>(`/api/reimbursements/${strId}/draft`, objPayload);
  return objResp.data;
};

/**
 * POST /api/reimbursements/:id/submit
 * Submit a draft (DRAFT → SUBMITTED).
 */
export const submitReimbursementApi = async (strId: string): Promise<Reimbursement> => {
  const objResp = await apiClient.post<Reimbursement>(`/api/reimbursements/${strId}/submit`);
  return objResp.data;
};

/**
 * GET /api/reimbursements/my?bucket=draft|pending|history
 * List reimbursements for the current user.
 */
export const listMyReimbursementsApi = async (strBucket?: string): Promise<ReimbursementListItem[]> => {
  const objResp = await apiClient.get<ReimbursementListItem[]>('/api/reimbursements/my', {
    params: { bucket: strBucket },
  });
  return objResp.data;
};

/**
 * GET /api/reimbursements/team?bucket=pending-approvals|pending-completion|history
 * List reimbursements where the current user is a reviewer.
 */
export type TeamBucket = 'pending-approvals' | 'pending-completion' | 'history';

export const listTeamReimbursementsApi = async (strBucket: TeamBucket): Promise<ReimbursementListItem[]> => {
  const objResp = await apiClient.get<ReimbursementListItem[]>('/api/reimbursements/team', {
    params: { bucket: strBucket },
  });
  return objResp.data;
};

/**
 * GET /api/reimbursements/:id
 * Get detailed view of a reimbursement.
 */
export const getReimbursementDetailApi = async (strId: string): Promise<Reimbursement> => {
  const objResp = await apiClient.get<Reimbursement>(`/api/reimbursements/${strId}`);
  return objResp.data;
};

/**
 * DELETE /api/reimbursements/:id
 * Delete a draft reimbursement.
 */
export const deleteReimbursementApi = async (strId: string): Promise<void> => {
  await apiClient.delete(`/api/reimbursements/${strId}`);
};

/**
 * GET /api/reimbursements/:id/chain
 * Get approval chain and visible logs.
 */
export interface ChainStep {
  level: number;
  user_id: string;
  name: string;
  email: string;
  role: string;
  department?: string;
  priority: number;
  approval_type: string;
  status: string;
  action?: string;
  received_date?: string;
  response_date?: string;
  remaining_days?: number;
  approved_at?: string;
  approved_by?: string;
  submitted_at?: string;
  is_initiator?: boolean;
}

export interface ChainLog {
  log_id: string;
  reimbursement_id: string;
  action: string;
  action_by: string;
  action_by_name?: string;
  action_by_email?: string;
  action_by_role?: string;
  action_by_department?: string;
  message: string;
  visibility: string;
  created_at: string;
}

export interface ChainViewResponse {
  approval_chain: ChainStep[];
  current_step: number;
  current_reviewer_id: string;
  logs: ChainLog[];
}

export const getReimbursementChainApi = async (strId: string): Promise<ChainViewResponse> => {
  const objResp = await apiClient.get<ChainViewResponse>(`/api/reimbursements/${strId}/chain`);
  return objResp.data;
};

/**
 * GET /api/reimbursements/:id/logs?log_types=edit,activity,view
 * Fetch all logs for a reimbursement, optionally filtered by type.
 */
export const getReimbursementLogsApi = async (
  strId: string,
  lsTypes?: ('edit' | 'activity' | 'view')[]
): Promise<ActivityLog[]> => {
  const strParams = lsTypes && lsTypes.length > 0 ? `?log_types=${lsTypes.join(',')}` : '';
  const objResp = await apiClient.get<ActivityLog[]>(`/api/reimbursements/${strId}/logs${strParams}`);
  return objResp.data;
};
