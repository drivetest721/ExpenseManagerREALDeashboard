/**
 * userApi.ts — Axios wrappers for User CRUD and hierarchy management.
 */
import { apiClient } from './apiClient';
import { User, UserCreateRequest, UserUpdateRequest, UserManagersUpdateRequest } from '../types/user';

/**
 * GET /api/users/list
 */
export const listUsersApi = async (strDeptId?: string, strRole?: string): Promise<User[]> => {
  const objParams: Record<string, string> = {};
  if (strDeptId) objParams.department_id = strDeptId;
  if (strRole) objParams.role = strRole;

  const objResp = await apiClient.get<User[]>('/api/users/list', { params: objParams });
  return objResp.data;
};

/**
 * GET /api/users/:id
 */
export const getUserApi = async (strId: string): Promise<User> => {
  const objResp = await apiClient.get<User>(`/api/users/${strId}`);
  return objResp.data;
};

/**
 * POST /api/users/create
 */
export const createUserApi = async (objPayload: UserCreateRequest): Promise<User> => {
  const objResp = await apiClient.post<User>('/api/users/create', objPayload);
  return objResp.data;
};

/**
 * PUT /api/users/:id
 */
export const updateUserApi = async (strId: string, objPayload: UserUpdateRequest): Promise<User> => {
  const objResp = await apiClient.put<User>(`/api/users/${strId}`, objPayload);
  return objResp.data;
};

/**
 * PUT /api/users/:id/managers
 */
export const updateManagersApi = async (strId: string, objPayload: UserManagersUpdateRequest): Promise<User> => {
  const objResp = await apiClient.put<User>(`/api/users/${strId}/managers`, objPayload);
  return objResp.data;
};

/**
 * DELETE /api/users/:id
 */
export const deleteUserApi = async (strId: string): Promise<void> => {
  await apiClient.delete(`/api/users/${strId}`);
};
