/**
 * authApi.ts — Axios wrappers for the Authentication endpoints.
 * All API calls go through the shared apiClient (handles JWT attachment / 401 redirect).
 */
import { apiClient, AUTH_TOKEN_KEY } from './apiClient';
import type { User } from '../types/user';

// ── Types ────────────────────────────────────────────────────────────────────

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  message: string;
  access_token: string;
  token_type: string;
  expires_in: number;
  user: User;
}

export interface MeResponse {
  success: boolean;
  user: User;
}

export interface SignupRequest {
  name: string;
  email: string;
  password: string;
  employee_id?: string;
}

export interface SignupResponse {
  success: boolean;
  message: string;
  email: string;
  expires_in: number;
}

export interface VerifyEmailRequest {
  email: string;
  code: string;
}

export interface ResendCodeResponse {
  success: boolean;
  message: string;
  expires_in: number;
}

// ── API Functions ─────────────────────────────────────────────────────────────

/**
 * POST /api/auth/login
 * Persists JWT to localStorage before returning.
 */
export const loginApi = async (objPayload: LoginRequest): Promise<LoginResponse> => {
  const objResp = await apiClient.post<LoginResponse>('/api/auth/login', objPayload);
  // Persist token immediately so subsequent calls are authenticated
  localStorage.setItem(AUTH_TOKEN_KEY, objResp.data.access_token);
  return objResp.data;
};

/**
 * POST /api/auth/logout
 * Clears token from localStorage regardless of server response.
 */
export const logoutApi = async (): Promise<void> => {
  try {
    await apiClient.post('/api/auth/logout');
  } finally {
    localStorage.removeItem(AUTH_TOKEN_KEY);
  }
};

/**
 * GET /api/auth/me
 * Returns the current authenticated user's profile.
 */
export const getMeApi = async (): Promise<MeResponse> => {
  const objResp = await apiClient.get<MeResponse>('/api/auth/me');
  return objResp.data;
};

/**
 * POST /api/auth/signup
 * Sends a verification code to the supplied email; does not create the user yet.
 */
export const signupApi = async (objPayload: SignupRequest): Promise<SignupResponse> => {
  const objResp = await apiClient.post<SignupResponse>('/api/auth/signup', objPayload);
  return objResp.data;
};

/**
 * POST /api/auth/verify-email
 * Verifies the OTP, creates the user, and persists the issued JWT to localStorage.
 */
export const verifyEmailApi = async (objPayload: VerifyEmailRequest): Promise<LoginResponse> => {
  const objResp = await apiClient.post<LoginResponse>('/api/auth/verify-email', objPayload);
  localStorage.setItem(AUTH_TOKEN_KEY, objResp.data.access_token);
  return objResp.data;
};

/**
 * POST /api/auth/resend-code
 * Requests a fresh verification code for an in-flight signup.
 */
export const resendCodeApi = async (strEmail: string): Promise<ResendCodeResponse> => {
  const objResp = await apiClient.post<ResendCodeResponse>('/api/auth/resend-code', { email: strEmail });
  return objResp.data;
};
