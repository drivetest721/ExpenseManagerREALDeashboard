export interface Department {
  department_id: string;
  department_name: string;
  owner_ids: string[];
  is_active: boolean;
}

export interface DepartmentCreateRequest {
  department_name: string;
  owner_ids: string[];
}

export interface DepartmentUpdateRequest {
  department_name?: string;
  owner_ids?: string[];
}
