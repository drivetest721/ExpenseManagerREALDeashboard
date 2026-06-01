export type UserRole = 'owner' | 'manager' | 'senior_manager' | 'employee' | 'ca' | 'intern';

export interface DepartmentEntry {
  department_id: string;
  department_name?: string;
  role: UserRole;
  is_primary: boolean;
}

export interface ManagerEntry {
  manager_id: string;
  manager_name?: string;
  priority: number;
  approval_type: 'mandatory' | 'optional';
}

export interface User {
  user_id: string;
  employee_id?: string;
  name: string;
  email: string;
  primary_role?: UserRole;
  departments: DepartmentEntry[];
  managers: ManagerEntry[];
  is_active: boolean;
  has_payment_method: boolean;
  ask_public_key?: string;
}

export interface UserCreateRequest {
  employee_id: string;
  name: string;
  email: string;
  password?: string; // Only for creation
  departments: DepartmentEntry[];
  managers: ManagerEntry[];
}

export interface UserUpdateRequest {
  name?: string;
  email?: string;
  is_active?: boolean;
  departments?: DepartmentEntry[];
}

export interface ManagerUpdateEntry {
  manager_id: string;
  priority: number;
  approval_type: 'mandatory' | 'optional';
}

export interface UserManagersUpdateRequest {
  managers: ManagerUpdateEntry[];
}
