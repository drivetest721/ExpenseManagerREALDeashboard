/**
 * categoryApi.ts — Axios wrappers for Category CRUD endpoints.
 */
import { apiClient } from './apiClient';
import type { Category, CategoryCreateRequest, CategoryUpdateRequest } from '../types/category';

/**
 * GET /api/categories/list
 * Returns all active categories. Available to any authenticated user.
 */
export const listCategoriesApi = async (include_inactive = false): Promise<Category[]> => {
  const objResp = await apiClient.get<Category[]>('/api/categories/list', { params: { include_inactive } });
  return objResp.data;
};

/**
 * POST /api/categories/create
 * Owner only.
 */
export const createCategoryApi = async (objPayload: CategoryCreateRequest): Promise<Category> => {
  const objResp = await apiClient.post<Category>('/api/categories/create', objPayload);
  return objResp.data;
};

/**
 * PUT /api/categories/:id
 * Owner only.
 */
export const updateCategoryApi = async (strId: string, objPayload: CategoryUpdateRequest): Promise<Category> => {
  const objResp = await apiClient.put<Category>(`/api/categories/${strId}`, objPayload);
  return objResp.data;
};

/**
 * DELETE /api/categories/:id
 * Owner only.
 */
export const deleteCategoryApi = async (strId: string): Promise<void> => {
  await apiClient.delete(`/api/categories/${strId}`);
};
