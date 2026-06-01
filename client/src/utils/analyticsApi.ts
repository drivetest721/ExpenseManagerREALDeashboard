/**
 * analyticsApi.ts — Axios wrappers for /api/analytics/* (Owner/CA only).
 */
import { apiClient } from './apiClient';
import type {
  AnalyticsSummary,
  StatusBucket,
  CategoryBucket,
  DepartmentBucket,
  MonthlyTrendPoint,
  TopSpender,
} from '../types/analytics';

export const getAnalyticsSummaryApi = async (): Promise<AnalyticsSummary> => {
  const objResp = await apiClient.get<AnalyticsSummary>('/api/analytics/summary');
  return objResp.data;
};

export const getAnalyticsByStatusApi = async (): Promise<StatusBucket[]> => {
  const objResp = await apiClient.get<StatusBucket[]>('/api/analytics/by-status');
  return objResp.data;
};

export const getAnalyticsByCategoryApi = async (): Promise<CategoryBucket[]> => {
  const objResp = await apiClient.get<CategoryBucket[]>('/api/analytics/by-category');
  return objResp.data;
};

export const getAnalyticsByDepartmentApi = async (): Promise<DepartmentBucket[]> => {
  const objResp = await apiClient.get<DepartmentBucket[]>('/api/analytics/by-department');
  return objResp.data;
};

export const getAnalyticsMonthlyTrendApi = async (iMonths = 6): Promise<MonthlyTrendPoint[]> => {
  const objResp = await apiClient.get<MonthlyTrendPoint[]>(`/api/analytics/monthly-trend?months=${iMonths}`);
  return objResp.data;
};

export const getAnalyticsTopSpendersApi = async (iLimit = 5): Promise<TopSpender[]> => {
  const objResp = await apiClient.get<TopSpender[]>(`/api/analytics/top-spenders?limit=${iLimit}`);
  return objResp.data;
};
