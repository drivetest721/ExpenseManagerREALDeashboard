/**
 * approvalApi.ts — Axios wrappers for Approval actions.
 */
import { apiClient } from './apiClient';

export interface ApprovalResponse {
  success: boolean;
  status: string;
}

/**
 * POST /api/approvals/:id/approve
 */
export const approveReimbursementApi = async (strId: string): Promise<ApprovalResponse> => {
  const objResp = await apiClient.post<ApprovalResponse>(`/api/approvals/${strId}/approve`);
  return objResp.data;
};

/**
 * POST /api/approvals/:id/query
 */
export const queryReimbursementApi = async (strId: string, strMessage: string): Promise<ApprovalResponse> => {
  const objResp = await apiClient.post<ApprovalResponse>(`/api/approvals/${strId}/query`, { message: strMessage });
  return objResp.data;
};

/**
 * POST /api/approvals/:id/ask
 */
export const askReimbursementApi = async (strId: string, strMessage: string): Promise<ApprovalResponse> => {
  const objResp = await apiClient.post<ApprovalResponse>(`/api/approvals/${strId}/ask`, { message: strMessage });
  return objResp.data;
};

/**
 * POST /api/approvals/:id/reapply
 */
export const reapplyReimbursementApi = async (strId: string, strMessage: string): Promise<ApprovalResponse> => {
  const objResp = await apiClient.post<ApprovalResponse>(`/api/approvals/${strId}/reapply`, { message: strMessage });
  return objResp.data;
};

// ── CA Workflow ─────────────────────────────────────────────────────────────

export interface PayRequest {
  transaction_ref: string;
  payment_method?: string;
  note?: string;
}

/**
 * POST /api/approvals/:id/ca/pay
 */
export const payReimbursementApi = async (strId: string, objPayload: PayRequest): Promise<ApprovalResponse> => {
  const objResp = await apiClient.post<ApprovalResponse>(`/api/approvals/${strId}/ca/pay`, objPayload);
  return objResp.data;
};

/**
 * POST /api/approvals/:id/ca/query
 */
export const caQueryReimbursementApi = async (strId: string, strMessage: string): Promise<ApprovalResponse> => {
  const objResp = await apiClient.post<ApprovalResponse>(`/api/approvals/${strId}/ca/query`, { message: strMessage });
  return objResp.data;
};

/**
 * POST /api/approvals/:id/ca/reapply
 */
export const caReapplyReimbursementApi = async (strId: string, strMessage: string): Promise<ApprovalResponse> => {
  const objResp = await apiClient.post<ApprovalResponse>(`/api/approvals/${strId}/ca/reapply`, { message: strMessage });
  return objResp.data;
};

/**
 * POST /api/approvals/:id/acknowledge
 */
export const acknowledgePaymentApi = async (strId: string, strNote?: string): Promise<ApprovalResponse> => {
  const objResp = await apiClient.post<ApprovalResponse>(`/api/approvals/${strId}/acknowledge`, { note: strNote });
  return objResp.data;
};

/**
 * POST /api/approvals/:id/ca/reject
 */
export const rejectReimbursementApi = async (strId: string, strMessage: string): Promise<ApprovalResponse> => {
  const objResp = await apiClient.post<ApprovalResponse>(`/api/approvals/${strId}/ca/reject`, { message: strMessage });
  return objResp.data;
};
