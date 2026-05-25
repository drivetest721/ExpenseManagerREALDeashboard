import type { UserRole } from './user';

export interface Category {
  category_id: string;
  name: string;
  sub_categories: string[];
  max_limit: number;
  allowed_roles: UserRole[];
  department_ids: string[];
  requires_invoice: boolean;
  approval_required: boolean;
  is_active: boolean;
}

export interface CategoryCreateRequest {
  name: string;
  sub_categories: string[];
  max_limit: number;
  allowed_roles: UserRole[];
  department_ids: string[];
  requires_invoice: boolean;
  approval_required: boolean;
}

export interface CategoryUpdateRequest {
  name?: string;
  sub_categories?: string[];
  max_limit?: number;
  allowed_roles?: UserRole[];
  department_ids?: string[];
  requires_invoice?: boolean;
  approval_required?: boolean;
  is_active?: boolean;
}

export interface Assignee {
  user_id: string;
  name: string;
  email: string;
  role: UserRole;
  department_id?: string;
  department_name?: string;
}

export interface AllowanceWithAssignees extends Category {
  assignees: Assignee[];
}
