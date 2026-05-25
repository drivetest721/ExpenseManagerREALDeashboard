---
name: backend.md
description: This skill defines backend development rules for the **real dashboard app** - a FastAPI + Python (3.13) + MongoDB application.
---

# backend.md

## Core Backend Architecture

### Tech Stack
- **Framework:** FastAPI (Python 3.13)
- **Database:** MongoDB (primary)
- **Authentication:** JWT tokens, BCrypt password hashing
<!-- - **Storage:** AWS S3 (document storage) -->
- **Validation:** Pydantic schemas
- **Email:** SMTP email service
<!-- - **Integrations:** ClickUp API, AWS Textract -->
<!-- - **Testing:** pytest -->

---

## Project Structure Rules

### File Organization
```
sourcecode/
├── routes/              # API route definitions (<feature>_routes.py)
├── schemas/             # Pydantic validation schemas (<feature>_schemas.py)
├── controllers/         # Business logic controllers
├── services/            # External service integrations
├── middleware/          # Custom middleware (JWT, auth, logging)
├── utils/               # Backend utility functions
├── config/              # Configuration (MongoDB, environment)
├── logs/                # Application logs
├── main.py              # FastAPI app entry point
└── env_config.py        # Environment configuration
```

### Naming Conventions
- **Route Files:** `<feature>_routes.py` (e.g., `user_routes.py`)
- **Schema Files:** `<feature>_schemas.py` (e.g., `user_schema.py`, `dashboard_schemas.py`)
- **Controllers:** Descriptive snake_case (e.g., `AWS_S3_Bucket_Helper.py`, `UserActivityLogger.py`)
- **Services:** `<service>_service.py` (e.g., `email_service.py`, `notification_service.py`)
- **Utils:** `<utility>_utils.py` (e.g., `file_management_utils.py`, `audit_logger.py`)

---

## Route File Standards

### Route File Structure
**EVERY route file MUST follow this structure:**

```python
'''
Purpose : Brief description of what this route file handles

Inputs  : HTTP requests with JWT authentication

Output  : JSON responses with appropriate data

Dependencies: fastapi, mongodb_config, schemas, jwt_middleware
'''

from fastapi import APIRouter, HTTPException, status, Depends, Query
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict, Any
from bson import ObjectId
import logging
import sys
import os
import traceback
from dotenv import load_dotenv

load_dotenv()

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config.mongodb_config import get_collection
from middleware.jwt_middleware import get_current_user_dependency
from schemas.<feature>_schemas import (
    RequestSchema,
    ResponseSchema,
)
from controllers.UserInteractivityLogController import log_user_page_access
from schemas.user_interactivity_schemas import PageNameEnum

# Configure logging
objLogger = logging.getLogger(__name__)

# Create router
router = APIRouter(
    prefix="/api/<feature>",
    tags=["<Feature Name>"]
)

# Route handlers go here...
```

**Rules:**
- ✅ **ALWAYS** include file-level docstring with Purpose, Inputs, Output, Dependencies
- ✅ **ALWAYS** import required dependencies at the top
- ✅ Use `objLogger` for logging (not `logger`)
- ✅ Create dedicated `APIRouter` with prefix and tags
- ✅ One route file per feature/page
- ✅ Place route files in `sourcecode/routes/` directory
- ❌ **NEVER** mix multiple unrelated features in one route file

---

## Function Documentation Standards

### Function-Level Comments
**EVERY function MUST have clear documentation:**

```python
@router.get("/example/{item_id}")
async def get_example_item(
    item_id: str,
    dictCurrentUser: dict = Depends(get_current_user_dependency)
):
    """
    Purpose : Retrieve a specific item by ID
    
    Inputs  :   (1) item_id         : Unique identifier for the item (str)
                (2) dictCurrentUser : Current user from JWT token (via Depends)
    
    Output  : JSON response with item data
    
    Example : GET /api/example/12345
              Headers: Authorization: Bearer <jwt_token>
              Response: {
                "success": true,
                "data": {...}
              }
    """
    try:
        objLogger.info(f"📥 GET EXAMPLE ITEM API CALLED by {dictCurrentUser.get('email')} | item_id={item_id}")

        # Get user ID from JWT token
        strUserId = str(dictCurrentUser.get('user_id'))
        if not strUserId:
            raise HTTPException(status_code=400, detail="User ID not found in token")

        # Business logic here

        objLogger.info(f"✅ Item retrieved successfully")
        return {
            "success": True,
            "data": result
        }

    except HTTPException:
        raise
    except Exception as e:
        objLogger.error(f"❌ Error retrieving item: {str(e)}")
        objLogger.error(traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving item: {str(e)}"
        )
```

**Rules:**
- ✅ **ALWAYS** include Purpose, Inputs, Output, Example in docstring
- ✅ Number inputs sequentially: (1), (2), (3), etc.
- ✅ Specify parameter types: (str), (int), (dict), etc.
- ✅ Include example HTTP request/response
- ✅ Use emojis for log messages (📥 for request, ✅ for success, ❌ for error)
- ❌ **NEVER** skip function documentation

---

## Exception Handling Standards

### Full Exception Handling
**EVERY endpoint MUST have comprehensive exception handling:**

```python
@router.post("/create")
async def create_item(
    request: ItemCreateRequest,
    dictCurrentUser: dict = Depends(get_current_user_dependency)
):
    """
    Purpose : Create a new item

    Inputs  :   (1) request         : Item creation data (ItemCreateRequest)
                (2) dictCurrentUser : Current user from JWT token

    Output  : JSON response with created item ID

    Example : POST /api/items/create
    """
    try:
        objLogger.info(f"📥 CREATE ITEM API CALLED by {dictCurrentUser.get('email')}")

        # Extract user ID
        strUserId = str(dictCurrentUser.get('user_id'))
        if not strUserId:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User ID not found in token"
            )

        # Validate required fields
        if not request.name:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Item name is required"
            )

        # Get MongoDB collection
        collection = get_collection("Items")

        # Business logic
        dictItemData = {
            "name": request.name,
            "created_by": strUserId,
            "created_at": datetime.now(timezone.utc),
        }

        result = collection.insert_one(dictItemData)

        objLogger.info(f"✅ Item created successfully | ID: {result.inserted_id}")

        return {
            "success": True,
            "message": "Item created successfully",
            "item_id": str(result.inserted_id)
        }

    except HTTPException:
        # Re-raise HTTP exceptions (already logged)
        raise
    except Exception as e:
        # Log unexpected errors
        objLogger.error(f"❌ Error creating item: {str(e)}")
        objLogger.error(traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating item: {str(e)}"
        )
```

**Exception Handling Rules:**
- ✅ **ALWAYS** wrap endpoint logic in `try-except` block
- ✅ Use specific exception types first (HTTPException, ValueError, etc.)
- ✅ Catch generic `Exception` last
- ✅ Log all errors with `objLogger.error()`
- ✅ Include `traceback.format_exc()` for debugging
- ✅ Re-raise `HTTPException` without modification
- ✅ Return user-friendly error messages
- ❌ **NEVER** expose internal error details to users
- ❌ **NEVER** skip exception handling

---

## Logging Standards

### Logging Patterns
```python
# Request received
objLogger.info(f"📥 GET ITEMS API CALLED by {dictCurrentUser.get('email')} | filter={filter_param}")

# Success
objLogger.info(f"✅ Items retrieved successfully | count={len(items)}")

# Warning
objLogger.warning(f"⚠️ No items found matching criteria | filter={filter_param}")

# Error
objLogger.error(f"❌ Error retrieving items: {str(e)}")
objLogger.error(traceback.format_exc())
```

**Logging Rules:**
- ✅ Use emojis for visual clarity: 📥 (request), ✅ (success), ⚠️ (warning), ❌ (error)
- ✅ Include user email in request logs
- ✅ Include relevant parameters and results
- ✅ Use `objLogger` (not `logger`)
- ✅ Log full traceback for errors
- ❌ **NEVER** log sensitive data (passwords, tokens, etc.)

---

## Schema File Standards

### Pydantic Schema Structure
**Create separate schemas for each HTTP method:**

```python
'''
Purpose : Pydantic schemas for <Feature> API validation

This file defines request/response schemas for <feature> endpoints.
'''

from pydantic import BaseModel, Field, validator
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum

# Enums for constrained values
class ItemStatusEnum(str, Enum):
    ACTIVE = "Active"
    INACTIVE = "Inactive"
    PENDING = "Pending"

# GET Request/Response Schemas
class ItemResponseSchema(BaseModel):
    item_id: str = Field(..., description="Unique item identifier")
    name: str = Field(..., description="Item name")
    status: ItemStatusEnum = Field(..., description="Item status")
    created_at: datetime = Field(..., description="Creation timestamp")

    class Config:
        from_attributes = True

# POST Request Schema
class ItemCreateRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=200, description="Item name")
    description: Optional[str] = Field(None, max_length=1000, description="Item description")

    @validator('name')
    def validate_name(cls, v):
        if not v.strip():
            raise ValueError("Name cannot be empty")
        return v.strip()

# PUT Request Schema
class ItemUpdateRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)
    status: Optional[ItemStatusEnum] = None

# DELETE Request Schema (if needed)
class ItemDeleteRequest(BaseModel):
    item_id: str = Field(..., description="ID of item to delete")
    reason: Optional[str] = Field(None, description="Reason for deletion")
```

**Schema Rules:**
- ✅ Create separate schemas for GET, POST, PUT, DELETE
- ✅ Use descriptive names: `<Feature><Action>Request/Response`
- ✅ Include field descriptions with `Field(..., description="...")`
- ✅ Use validators for custom validation logic
- ✅ Use `Enum` for constrained string values
- ✅ Place schema files in `sourcecode/schemas/` directory
- ✅ One schema file per feature
- ❌ **NEVER** reuse POST schemas for PUT (create separate schemas)

### Schema Validation Verification
**After creating any Pydantic schema:**

1. **Cross-verify with phase planning file:**
   - Ensure all required fields are included
   - Verify field types match specifications
   - Check field constraints (min/max length, patterns, etc.)

2. **Validate in route file:**
   ```python
   @router.post("/create")
   async def create_item(request: ItemCreateRequest):  # Pydantic auto-validates
       # If validation fails, FastAPI automatically returns 422 error
       pass
   ```

3. **Backend route validation:**
   - When route parameters depend on schemas, implement type checking
   - Handle validation failures gracefully
   - Return clear error messages

---

## Middleware Pattern for Database Connections

### Always Use Middleware
**NEVER make direct database connections in route handlers:**

```python
# ✅ CORRECT: Use middleware
from config.mongodb_config import get_collection

@router.get("/items")
async def get_items():
    collection = get_collection("Items")  # Middleware handles connection
    items = list(collection.find({}))
    return items

# ❌ WRONG: Direct connection
from pymongo import MongoClient

@router.get("/items")
async def get_items():
    client = MongoClient("mongodb://...")  # DON'T DO THIS
    db = client["database"]
    collection = db["Items"]
    items = list(collection.find({}))
    return items
```

**Middleware Rules:**
- ✅ **ALWAYS** import `get_collection` from `config.mongodb_config`
- ✅ Use middleware for all database operations
- ✅ Middleware handles connection pooling and error handling
- ❌ **NEVER** create direct MongoDB connections in routes
- ❌ **NEVER** hardcode database credentials

---

## Generic Functions in Utils

### Reusable Code in Utils Folder
**Place generic, reusable functions in `sourcecode/utils/`:**

```python
# sourcecode/utils/date_utils.py
'''
Purpose : Date and time utility functions

This module provides reusable date/time operations used across the application.
'''

from datetime import datetime, timezone, timedelta

def get_current_mst_time() -> datetime:
    """
    Purpose : Get current time in MST timezone (UTC-7, Arizona - no DST)

    Inputs  : None

    Output  : datetime object in MST timezone

    Example : dt = get_current_mst_time()
              print(dt)  # 2026-05-12 10:30:00-07:00
    """
    mst_tz = timezone(timedelta(hours=-7))
    return datetime.now(mst_tz)

def format_date_mst(dt: datetime) -> str:
    """
    Purpose : Format datetime as MM/DD/YYYY HH:MM MST

    Inputs  :   (1) dt : datetime object to format

    Output  : Formatted date string

    Example : formatted = format_date_mst(datetime.now())
              # "05/12/2026 10:30 MST"
    """
    return dt.strftime("%m/%d/%Y %H:%M MST")
```

**Utils Rules:**
- ✅ Create utility modules for reusable functions
- ✅ Document each function with Purpose, Inputs, Output, Example
- ✅ Keep functions focused and single-purpose
- ✅ Import and use utils across multiple route files
- ✅ Place utils in `sourcecode/utils/` directory
- ❌ **NEVER** duplicate code - create utils instead

---

## Authentication & Authorization

### JWT Middleware Usage
```python
from middleware.jwt_middleware import (
    get_current_user_dependency,
    get_admin_user_dependency
)

# Any authenticated user
@router.get("/items")
async def get_items(
    dictCurrentUser: dict = Depends(get_current_user_dependency)
):
    # dictCurrentUser contains: user_id, email, full_name, department, role
    pass

# Admin users only
@router.delete("/items/{item_id}")
async def delete_item(
    item_id: str,
    dictCurrentUser: dict = Depends(get_admin_user_dependency)
):
    # Only Admin/Super Admin can access
    pass
```

**Auth Rules:**
- ✅ Use `get_current_user_dependency` for authenticated endpoints
- ✅ Use `get_admin_user_dependency` for admin-only endpoints
- ✅ Extract `user_id` from `dictCurrentUser`
- ✅ Include user email in logs
- ❌ **NEVER** implement custom JWT validation - use middleware

---

## Environment Configuration

### Environment Variables
```python
import os
from dotenv import load_dotenv

load_dotenv()

# AWS S3 Configuration
S3_BUCKET_NAME = os.getenv('S3_BUCKET_NAME')
S3_BUCKET_REGION = os.getenv('S3_BUCKET_REGION')

# MongoDB Configuration
MONGODB_URL = os.getenv('MONGODB_URL')
MONGODB_DATABASE = os.getenv('MONGODB_DATABASE')

# JWT Configuration
JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY')
```

**Environment Rules:**
- ✅ Load `.env` file at module top
- ✅ Use `os.getenv()` for environment variables
- ✅ Provide default values for non-sensitive configs
- ✅ Validate required variables at startup
- ❌ **NEVER** hardcode credentials or secrets
- ❌ **NEVER** commit `.env` file to git

---

## Code Quality & Best Practices

### Before Committing Checklist
- [ ] All functions have Purpose, Inputs, Output, Example docs
- [ ] Full exception handling implemented
- [ ] Logging added for all operations
- [ ] Pydantic schemas created and validated
- [ ] Middleware used for database connections
- [ ] Generic functions moved to utils/
- [ ] Unit tests created and passing
- [ ] No hardcoded credentials or sensitive data
- [ ] Route file follows standard structure
- [ ] Schema fields verified against requirements

### Performance Best Practices
- ✅ Use database indexes for frequently queried fields
- ✅ Limit query results with pagination
- ✅ Use projection to return only needed fields
- ✅ Cache frequently accessed data
- ✅ Use async/await for I/O operations

### Security Best Practices
- ✅ Validate all user inputs with Pydantic
- ✅ Sanitize user-provided data before database queries
- ✅ Use parameterized queries (MongoDB automatically does this)
- ✅ Implement rate limiting for sensitive endpoints
- ✅ Log security-related events
- ❌ **NEVER** trust user input
- ❌ **NEVER** expose internal error details

---

## Integration with Frontend

### API Response Format
**Use consistent response format:**

```python
# Success response
{
    "success": True,
    "message": "Operation completed successfully",
    "data": {...}
}

# Error response
{
    "success": False,
    "message": "Error message",
    "detail": "Additional error details"
}

# List response with pagination
{
    "success": True,
    "data": [...],
    "total": 100,
    "page": 1,
    "limit": 10
}
```

### Parameter Consistency
**Backend and Frontend must match exactly:**

```python
# Backend (routes.py)
@router.post("/create")
async def create_item(request: ItemCreateRequest):
    # request.name, request.description
    pass

# Frontend (itemApi.ts)
export const createItem = async (data: {
  name: string;
  description?: string;
}) => {
  return axios.post(`${API_BASE_URL}/api/items/create`, data);
};
```

**Rules:**
- ✅ Parameter names must match between frontend and backend
- ✅ Parameter types must match (string, number, boolean, etc.)
- ✅ Optional parameters must be marked as `Optional` (backend) and `?` (frontend)
- ✅ Validate frontend API calls match backend schemas

---

## Summary Checklist

When creating or modifying backend routes:

✅ **DO:**
- Create separate route file for each page/feature
- Include file-level and function-level documentation
- Implement full exception handling with logging
- Create separate Pydantic schemas for GET/POST/PUT/DELETE
- Verify schema fields match requirements
- Use middleware for database connections
- Move reusable code to utils/
- Create unit tests for all APIs
- Use JWT middleware for authentication
- Follow consistent naming conventions
- Validate all user inputs
- Return user-friendly error messages

❌ **DON'T:**
- Mix multiple unrelated features in one route file
- Skip function documentation
- Skip exception handling or logging
- Reuse POST schemas for PUT requests
- Make direct database connections
- Duplicate code across multiple files
- Skip writing tests
- Hardcode credentials or sensitive data
- Expose internal error details to users

---

**Last Updated:** May 2026
**Framework:** FastAPI and Python 3.13 and MongoDB
```
