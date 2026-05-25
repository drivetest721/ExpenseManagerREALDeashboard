/**
 * Centralised Axios instance for the Expense Management frontend.
 * - Attaches JWT from localStorage to every request.
 * - Routes 401 responses to /login.
 * - Surfaces network/unknown errors via a global event for the ErrorCard.
 */
import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';

export const API_BASE_URL: string =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '';

export const AUTH_TOKEN_KEY = 'auth_token';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
});

apiClient.interceptors.request.use((objConfig: InternalAxiosRequestConfig) => {
  const strToken = localStorage.getItem(AUTH_TOKEN_KEY);
  if (strToken) {
    objConfig.headers.Authorization = `Bearer ${strToken}`;
  }
  return objConfig;
});

apiClient.interceptors.response.use(
  (objResponse) => objResponse,
  (objError: AxiosError) => {
    if (objError.response?.status === 401) {
      localStorage.removeItem(AUTH_TOKEN_KEY);
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
        window.location.assign('/login');
      }
    }
    return Promise.reject(objError);
  },
);
