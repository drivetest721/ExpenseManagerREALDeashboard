/**
 * holidayApi.ts — Axios wrappers for Holiday endpoints.
 */
import { apiClient } from './apiClient';

export interface Holiday {
  holiday_id: string;
  date: string;       // YYYY-MM-DD
  name: string;
  created_at: string;
  created_by: string;
}

export interface HolidayCreateRequest {
  date: string;
  name: string;
}

/** GET /api/holidays/list */
export const listHolidaysApi = async (): Promise<Holiday[]> => {
  const objResp = await apiClient.get<Holiday[]>('/api/holidays/list');
  return objResp.data;
};

/** POST /api/holidays/create */
export const createHolidayApi = async (payload: HolidayCreateRequest): Promise<Holiday> => {
  const objResp = await apiClient.post<Holiday>('/api/holidays/create', payload);
  return objResp.data;
};

/** DELETE /api/holidays/:id */
export const deleteHolidayApi = async (strId: string): Promise<void> => {
  await apiClient.delete(`/api/holidays/${strId}`);
};
