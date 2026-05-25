/**
 * allowanceApi.ts — Axios wrappers for Allowance read-only endpoints.
 */
import { apiClient } from './apiClient';
import type { Category, AllowanceWithAssignees } from '../types/category';

/**
 * GET /api/allowance/my
 * Returns categories the current logged-in user is eligible for.
 */
export const getMyAllowanceApi = async (): Promise<Category[]> => {
  const objResp = await apiClient.get<Category[]>('/api/allowance/my');
  return objResp.data;
};

/**
 * GET /api/allowance/all
 * Admin/Owner view — returns all categories with matched assignees.
 */
export const getAllAllowanceApi = async (): Promise<AllowanceWithAssignees[]> => {
  const objResp = await apiClient.get<AllowanceWithAssignees[]>('/api/allowance/all');
  return objResp.data;
};
