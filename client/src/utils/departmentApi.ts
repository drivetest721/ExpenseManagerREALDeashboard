/**
 * departmentApi.ts — Axios wrappers for Department CRUD.
 */
import { apiClient } from './apiClient';
import type { Department, DepartmentCreateRequest, DepartmentUpdateRequest } from '../types/department';

/**
 * GET /api/departments/list
 */
export const listDepartmentsApi = async (): Promise<Department[]> => {
  const objResp = await apiClient.get<Department[]>('/api/departments/list');
  return objResp.data;
};

/**
 * POST /api/departments/create
 */
export const createDepartmentApi = async (objPayload: DepartmentCreateRequest): Promise<Department> => {
  const objResp = await apiClient.post<Department>('/api/departments/create', objPayload);
  return objResp.data;
};

/**
 * PUT /api/departments/:id
 */
export const updateDepartmentApi = async (strId: string, objPayload: DepartmentUpdateRequest): Promise<Department> => {
  const objResp = await apiClient.put<Department>(`/api/departments/${strId}`, objPayload);
  return objResp.data;
};

/**
 * DELETE /api/departments/:id
 */
export const deleteDepartmentApi = async (strId: string): Promise<void> => {
  await apiClient.delete(`/api/departments/${strId}`);
};
