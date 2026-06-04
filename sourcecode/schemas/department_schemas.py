'''
Purpose : Pydantic schemas for Department CRUD operations.

Inputs  : None (schema definitions).

Output  : Validated Pydantic models for request/response handling.

Dependencies: pydantic
'''

from typing import List, Optional
from pydantic import BaseModel, Field


class DepartmentCreateRequest(BaseModel):
    """Schema for creating a new department."""
    department_id: str = Field(..., description="Unique identifier for the department")
    department_name: str = Field(..., min_length=2, max_length=100)
    owner_ids: List[str] = Field(default_factory=list, description="List of User IDs who own this department.")


class DepartmentUpdateRequest(BaseModel):
    """Schema for updating an existing department."""
    department_name: Optional[str] = Field(None, min_length=2, max_length=100)
    owner_ids: Optional[List[str]] = None


class DepartmentResponseSchema(BaseModel):
    """Schema for returning department details."""
    department_id: str
    department_name: str
    owner_ids: List[str]
    is_active: bool = True
