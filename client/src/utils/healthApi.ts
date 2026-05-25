/**
 * Health-check API client. Used by the landing page during Phase 0 to verify
 * backend connectivity end-to-end.
 */
import { apiClient } from './apiClient';

export interface HealthResponse {
  success: boolean;
  app: string;
  env: string;
  version: string;
}

export const getHealth = async (): Promise<HealthResponse> => {
  const objResponse = await apiClient.get<HealthResponse>('/api/health');
  return objResponse.data;
};
