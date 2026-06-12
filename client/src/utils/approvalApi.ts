/**
 * approvalApi.ts — Axios wrappers for Approval actions.
 * UPDATED: Removed CA-specific routes (/ca/), unified all approval actions.
 */
import { apiClient } from './apiClient';
import type { Reimbursement } from '../types/reimbursement';

export interface ApprovalResponse {
  success: boolean;
  status: string;
  reimbursement?: Reimbursement; // NEW: Return updated reimbursement data
}

// ── Core Approval Actions ──────────────────────────────────────────────────────

/**
 * POST /api/approvals/:id/approve
 * UPDATED: Works for all reviewer types (manager, owner, CA)
 */
export const approveReimbursementApi = async (strId: string): Promise<ApprovalResponse> => {
  const objResp = await apiClient.post<ApprovalResponse>(`/api/approvals/${strId}/approve`);
  return objResp.data;
};

/**
 * POST /api/approvals/:id/query
 * UPDATED: Unified route for all reviewer types (replaces ca/query)
 */
export const queryReimbursementApi = async (strId: string, strMessage: string): Promise<ApprovalResponse> => {
  const objResp = await apiClient.post<ApprovalResponse>(`/api/approvals/${strId}/query`, { message: strMessage });
  return objResp.data;
};

/**
 * POST /api/approvals/:id/ask
 * UPDATED: Works for all reviewer types
 */
export const askReimbursementApi = async (strId: string, strMessage: string): Promise<ApprovalResponse> => {
  const objResp = await apiClient.post<ApprovalResponse>(`/api/approvals/${strId}/ask`, { message: strMessage });
  return objResp.data;
};

/**
 * POST /api/approvals/:id/reapply
 * UPDATED: Handles bIsReApply flag for initiator step tracking
 */
export const reapplyReimbursementApi = async (strId: string, strMessage: string): Promise<ApprovalResponse> => {
  const objResp = await apiClient.post<ApprovalResponse>(`/api/approvals/${strId}/reapply`, { message: strMessage });
  return objResp.data;
};

// ── Payment & Final Actions ────────────────────────────────────────────────────

export interface PayRequest {
  transaction_ref: string;
  payment_method?: string;
  note?: string;
  payment_proof_attachment_id?: string;  // Attachment ID for proof of payment document
}

/**
 * POST /api/approvals/:id/pay
 * UPDATED: Unified route (removed /ca/ prefix), works for final reviewer
 */
export const payReimbursementApi = async (strId: string, objPayload: PayRequest): Promise<ApprovalResponse> => {
  const objResp = await apiClient.post<ApprovalResponse>(`/api/approvals/${strId}/pay`, objPayload);
  return objResp.data;
};

/**
 * POST /api/approvals/:id/reject
 * UPDATED: Unified route (removed /ca/ prefix), works for any reviewer
 */
export const rejectReimbursementApi = async (strId: string, strMessage: string): Promise<ApprovalResponse> => {
  const objResp = await apiClient.post<ApprovalResponse>(`/api/approvals/${strId}/reject`, { message: strMessage });
  return objResp.data;
};

/**
 * POST /api/approvals/:id/acknowledge
 * UPDATED: Terminal state is ACKNOWLEDGED instead of CLOSED
 */
export const acknowledgePaymentApi = async (strId: string, strNote?: string): Promise<ApprovalResponse> => {
  const objResp = await apiClient.post<ApprovalResponse>(`/api/approvals/${strId}/acknowledge`, { note: strNote });
  return objResp.data;
};

// ── Step Tracking ───────────────────────────────────────────────────────────────

export interface MarkViewedResponse {
  success: boolean;
  message: string;
}

/**
 * POST /api/approvals/:id/mark-viewed
 * NEW: Marks reimbursement as viewed by current reviewer (sets receivedAt timestamp)
 */
export const markReimbursementViewedApi = async (strId: string): Promise<MarkViewedResponse> => {
  // console.log(`Marking reimbursement ${strId} as viewed at step ${iCurrentStep}`);
  const objResp = await apiClient.post<MarkViewedResponse>(`/api/approvals/${strId}/mark-viewed`);
  return objResp.data;
};

// ── DEPRECATED: Backward Compatibility Aliases ──────────────────────────────────

/**
 * @deprecated Use queryReimbursementApi instead (unified route)
 */
export const caQueryReimbursementApi = queryReimbursementApi;

/**
 * @deprecated Use reapplyReimbursementApi instead (unified route)
 */
export const caReapplyReimbursementApi = reapplyReimbursementApi;
