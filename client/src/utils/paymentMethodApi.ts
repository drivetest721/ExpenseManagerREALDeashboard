/**
 * paymentMethodApi.ts — Axios wrappers for Payment Method endpoints.
 */
import { apiClient } from './apiClient';
import type { PaymentMethod, PaymentMethodCreateRequest } from '../types/paymentMethod';

/**
 * GET /api/payment-methods/my
 * Returns all payment methods for the current user.
 */
export const listMyPaymentMethodsApi = async (): Promise<PaymentMethod[]> => {
  const objResp = await apiClient.get<PaymentMethod[]>('/api/payment-methods/my');
  return objResp.data;
};

/**
 * POST /api/payment-methods/create
 */
export const createPaymentMethodApi = async (objPayload: PaymentMethodCreateRequest): Promise<PaymentMethod> => {
  const objResp = await apiClient.post<PaymentMethod>('/api/payment-methods/create', objPayload);
  return objResp.data;
};

/**
 * PUT /api/payment-methods/:id/default
 */
export const setDefaultPaymentMethodApi = async (strId: string): Promise<PaymentMethod> => {
  const objResp = await apiClient.put<PaymentMethod>(`/api/payment-methods/${strId}/default`);
  return objResp.data;
};

/**
 * DELETE /api/payment-methods/:id
 */
export const deletePaymentMethodApi = async (strId: string): Promise<void> => {
  await apiClient.delete(`/api/payment-methods/${strId}`);
};
