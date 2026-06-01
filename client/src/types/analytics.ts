/**
 * analytics.ts — types for the analytics dashboard endpoints.
 */
import type { ReimbursementStatus } from './reimbursement';

export interface AnalyticsSummary {
  totals: {
    count: number;
    draft: number;
    pending: number;
    approved: number;
    paid: number;
    rejected: number;
  };
  amounts: {
    total: number;
    paid: number;
    pending: number;
    approved: number;
  };
}

export interface StatusBucket {
  status: ReimbursementStatus | string;
  count: number;
  amount: number;
}

export interface CategoryBucket {
  category_id: string;
  name: string;
  count: number;
  amount: number;
}

export interface DepartmentBucket {
  department_id: string;
  name: string;
  count: number;
  amount: number;
}

export interface MonthlyTrendPoint {
  month: string;   // YYYY-MM
  label: string;   // e.g. "Jan 2026"
  count: number;
  amount: number;
}

export interface TopSpender {
  user_id: string;
  name: string;
  count: number;
  amount: number;
}
