'''
Purpose : CRUD routes for Users — create, list, view, update, and hierarchy management.

Inputs  : HTTP requests (JSON bodies for mutations, query/path params).

Output  : JSON success/error responses with User profiles.

Dependencies: fastapi, mongodb_config, jwt_middleware, user_schemas, AuditLogger, bcrypt
'''

import logging
from typing import List, Optional
from fastapi import APIRouter, HTTPException, status, Depends, Query
from bson import ObjectId
import bcrypt

from config.mongodb_config import get_collection
from middleware.jwt_middleware import getAdminUserDependency, getOwnerUserDependency, getCurrentUserDependency
from schemas.user_schemas import (
    UserCreateRequest,
    UserUpdateRequest,
    UserResponseSchema,
    UserManagersUpdateRequest,
    UserCategoriesUpdateRequest,
)
from controllers.AuditLogger import logMutation

objLogger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/users", tags=["Users"])


def _hashPassword(strPlain: str) -> str:
    """
    purpose: Hash a plaintext password using bcrypt, ensuring it is truncated to 72 bytes to comply with bcrypt's limitations.
    
    Inputs: (1) strPlain: The plaintext password to be hashed (string).

    Output: A bcrypt hash of the password (string).

    Example: _hashPassword("mysecretpassword") → "$2b$12$KIXQ1e5u1Z8e5G9v1a8OeXyZ1j6h3s9f0g7h8i9j0k1l2m3n4o5p6q"
    """
    
    return bcrypt.hashpw(strPlain.encode("utf-8")[:72], bcrypt.gensalt()).decode("utf-8")


def _detectCircularHierarchy(user_id: str, new_manager_id: str, objUsers) -> bool:
    """
    Purpose : Check if assigning new_manager_id as a manager of user_id would create a circular hierarchy.
    
    Inputs: (1) user_id: The ID of the user being assigned a new manager (string).
            (2) new_manager_id: The ID of the new manager being assigned (string).
            (3) objUsers: The MongoDB collection object for users.
    
    Output: True if circular dependency detected, False otherwise.

    Algorithm: Walk up the manager chain from new_manager_id. If we encounter user_id, it's circular.
    """
    visited = set()
    current = new_manager_id

    while current:
        # If we've reached the user we're trying to assign a manager to, it's circular
        if current == user_id:
            return True

        # Prevent infinite loops if data is already corrupted
        if current in visited:
            break
        visited.add(current)

        # Get current user's first manager (primary approver)
        try:
            dictUser = objUsers.find_one({"_id": ObjectId(current)}, {"managers": 1})
            if not dictUser or not dictUser.get("managers"):
                break

            # Follow the chain through the highest priority manager
            lsManagers = sorted(dictUser["managers"], key=lambda m: m.get("priority", 999))
            current = lsManagers[0].get("manager_id") if lsManagers else None
        except:
            break

    return False


@router.post("/create", response_model=UserResponseSchema, status_code=status.HTTP_201_CREATED)
async def createUser(
    objRequest: UserCreateRequest,
    dictCurrentUser: dict = Depends(getAdminUserDependency),
):
    """
    Purpose : Create a new user with hashed password.
    
    Inputs: (1) objRequest: UserCreateRequest schema containing user details and plaintext password.
            (2) dictCurrentUser: The currently authenticated admin user performing the operation (injected by dependency).

    Output: UserResponseSchema containing the created user's details (excluding password).

    Access  : Admin (Owner).
    """
    try:
        objUsers = get_collection("users")

        if objUsers.find_one({"email": objRequest.email.lower()}):
            raise HTTPException(status_code=400, detail="User with this email already exists")

        if objUsers.find_one({"employee_id": objRequest.employee_id}):
            raise HTTPException(status_code=400, detail="User with this employee ID already exists")

        dictNewUser = objRequest.model_dump()
        dictNewUser["email"] = dictNewUser["email"].lower()
        dictNewUser["password_hash"] = _hashPassword(dictNewUser.pop("password"))
        dictNewUser["is_active"] = True
        dictNewUser["has_payment_method"] = False
        dictNewUser.setdefault("default_allowances", [])

        objResult = objUsers.insert_one(dictNewUser)
        strId = str(objResult.inserted_id)

        # Build response manually to include user_id
        dictNewUser["user_id"] = strId

        logMutation("users", None, dictNewUser, "INSERT", dictCurrentUser["user_id"], strId)

        return UserResponseSchema(**dictNewUser)

    except HTTPException:
        raise
    except Exception as objErr:
        objLogger.error(f"❌ CREATE USER ERROR: {objErr}")
        raise HTTPException(status_code=500, detail=str(objErr))


@router.get("/list", response_model=List[UserResponseSchema])
async def listUsers(
    department_id: Optional[str] = Query(None),
    role: Optional[str] = Query(None),
    dictCurrentUser: dict = Depends(getCurrentUserDependency),
):
    """
    Purpose : List users, optionally filtered by department or role.

    Inputs  : (1) department_id: Optional query parameter to filter users by department ID.
              (2) role: Optional query parameter to filter users by role within their department.
              (3) dictCurrentUser: The currently authenticated user making the request (injected by dependency).

    Access  : Any authenticated user.
    """
    try:
        objUsers = get_collection("users")
        query = {"is_active": True}

        if department_id:
            query["departments.department_id"] = department_id
        if role:
            query["departments.role"] = role

        lsUsers = list(objUsers.find(query))
        lsResponse = []
        for dictUser in lsUsers:
            dictUser["user_id"] = str(dictUser.pop("_id"))
            lsResponse.append(UserResponseSchema(**dictUser))

        return lsResponse

    except Exception as objErr:
        objLogger.error(f"❌ LIST USERS ERROR: {objErr}")
        raise HTTPException(status_code=500, detail=str(objErr))


@router.get("/{user_id}", response_model=UserResponseSchema)
async def getUser(
    user_id: str,
    dictCurrentUser: dict = Depends(getCurrentUserDependency),
):
    """
    Purpose : Get detailed profile of a single user.

    Inputs  : (1) user_id: The ID of the user to retrieve (path parameter).
              (2) dictCurrentUser: The currently authenticated user making the request (injected by dependency).

    Output  : UserResponseSchema containing the user's details.        

    Access  : Any authenticated user.
    """
    try:
        objUsers = get_collection("users")
        dictUser = objUsers.find_one({"_id": ObjectId(user_id)})

        if not dictUser:
            raise HTTPException(status_code=404, detail="User not found")

        dictUser["user_id"] = str(dictUser.pop("_id"))
        return UserResponseSchema(**dictUser)

    except Exception as objErr:
        objLogger.error(f"❌ GET USER ERROR: {objErr}")
        raise HTTPException(status_code=500, detail=str(objErr))


@router.put("/{user_id}", response_model=UserResponseSchema)
async def updateUser(
    user_id: str,
    objRequest: UserUpdateRequest,
    dictCurrentUser: dict = Depends(getAdminUserDependency),
):
    """
    Purpose : Update basic user info (name, email, activity).

    Inputs  : (1) user_id: The ID of the user to update (path parameter).
              (2) objRequest: UserUpdateRequest schema containing fields to update (name, email, is_active).
              (3) dictCurrentUser: The currently authenticated admin user performing the operation (injected by dependency).                
    
    Output  : UserResponseSchema containing the updated user's details.

    Access  : Admin (Owner).
    """
    try:
        objUsers = get_collection("users")
        dictOld = objUsers.find_one({"_id": ObjectId(user_id)})

        if not dictOld:
            raise HTTPException(status_code=404, detail="User not found")

        dictUpdates = objRequest.model_dump(exclude_unset=True)
        if "email" in dictUpdates:
            dictUpdates["email"] = dictUpdates["email"].lower()

        if "password" in dictUpdates:
            dictUpdates["password_hash"] = _hashPassword(dictUpdates.pop("password"))

        if not dictUpdates:
            raise HTTPException(status_code=400, detail="No updates provided")

        objUsers.update_one({"_id": ObjectId(user_id)}, {"$set": dictUpdates})

        dictNew = objUsers.find_one({"_id": ObjectId(user_id)})
        dictNew["user_id"] = str(dictNew.pop("_id"))

        logMutation("users", dictOld, dictNew, "UPDATE", dictCurrentUser["user_id"], user_id)

        return UserResponseSchema(**dictNew)

    except HTTPException:
        raise
    except Exception as objErr:
        objLogger.error(f"❌ UPDATE USER ERROR: {objErr}")
        raise HTTPException(status_code=500, detail=str(objErr))

    
@router.put("/{user_id}/managers", response_model=UserResponseSchema)
async def updateManagers(
    user_id: str,
    objRequest: UserManagersUpdateRequest,
    dictCurrentUser: dict = Depends(getOwnerUserDependency),
):
    """
    Purpose : Update user's manager hierarchy.

    Inputs  : (1) user_id: The ID of the user to update (path parameter).
              (2) objRequest: UserManagersUpdateRequest schema containing the new list of managers with their priorities and approval types.
              (3) dictCurrentUser: The currently authenticated owner user performing the operation (injected by dependency).
    
    Output  : UserResponseSchema containing the updated user's details.

    Access  : Owner only.

    Validation: No self-management, unique priorities.
    """
    try:
        objUsers = get_collection("users")
        dictOld = objUsers.find_one({"_id": ObjectId(user_id)})

        if not dictOld:
            raise HTTPException(status_code=404, detail="User not found")

        lsManagers = objRequest.managers

        # Validation: Unique priorities
        lsPriorities = [m.priority for m in lsManagers]
        if len(lsPriorities) != len(set(lsPriorities)):
            raise HTTPException(status_code=400, detail="Manager priorities must be unique")

        # Validation: No self-management
        for m in lsManagers:
            if m.manager_id == user_id:
                raise HTTPException(status_code=400, detail="User cannot manage themselves")

            # Verify manager exists
            if not objUsers.find_one({"_id": ObjectId(m.manager_id)}):
                raise HTTPException(status_code=400, detail=f"Manager {m.manager_id} not found")

            # Validation: No circular hierarchy (transitive dependency check)
            if _detectCircularHierarchy(user_id, m.manager_id, objUsers):
                raise HTTPException(
                    status_code=400,
                    detail=f"Circular hierarchy detected: Assigning manager {m.manager_id} would create a circular dependency"
                )

        # Resolve manager names for storage
        lsResolvedManagers = []
        for m in lsManagers:
            dictMgr = objUsers.find_one({"_id": ObjectId(m.manager_id)}, {"name": 1})
            lsResolvedManagers.append({
                "manager_id": m.manager_id,
                "manager_name": dictMgr["name"],
                "priority": m.priority,
                "approval_type": m.approval_type,
            })

        objUsers.update_one({"_id": ObjectId(user_id)}, {"$set": {"managers": lsResolvedManagers}})

        dictNew = objUsers.find_one({"_id": ObjectId(user_id)})
        dictNew["user_id"] = str(dictNew.pop("_id"))

        logMutation("users", dictOld, dictNew, "UPDATE_MANAGERS", dictCurrentUser["user_id"], user_id)

        return UserResponseSchema(**dictNew)

    except HTTPException:
        raise
    except Exception as objErr:
        objLogger.error(f"❌ UPDATE MANAGERS ERROR: {objErr}")
        raise HTTPException(status_code=500, detail=str(objErr))


@router.put("/{user_id}/categories", response_model=UserResponseSchema)
async def updateCategories(
    user_id: str,
    objRequest: UserCategoriesUpdateRequest,
    dictCurrentUser: dict = Depends(getOwnerUserDependency),
):
    """
    Purpose : Update user's default category allowances.

    Inputs  : (1) user_id: The ID of the user to update (path parameter).
              (2) objRequest: UserCategoriesUpdateRequest schema containing the new list of default allowances with category IDs, sub-categories, and limits.
              (3) dictCurrentUser: The currently authenticated owner user performing the operation (injected by dependency).

    Output  : UserResponseSchema containing the updated user's details.

    Access  : Owner only.
    
    Validation: Duplicate category check, category existence verification.
    """
    try:
        objUsers = get_collection("users")
        objCategories = get_collection("reimbursement_categories")

        dictOld = objUsers.find_one({"_id": ObjectId(user_id)})

        if not dictOld:
            raise HTTPException(status_code=404, detail="User not found")

        lsAllowances = objRequest.default_allowances

        # Validation: Check for duplicate category_id entries
        lsCategoryIds = [a.category_id for a in lsAllowances]
        if len(lsCategoryIds) != len(set(lsCategoryIds)):
            raise HTTPException(status_code=400, detail="Duplicate category assignments not allowed")

        # Validation: Verify all categories exist and are active
        for a in lsAllowances:
            dictCat = objCategories.find_one({"_id": ObjectId(a.category_id), "is_active": True})
            if not dictCat:
                raise HTTPException(status_code=400, detail=f"Category {a.category_id} not found or inactive")

            # Validate sub_category if provided
            if a.sub_category and a.sub_category not in dictCat.get("sub_categories", []):
                raise HTTPException(
                    status_code=400,
                    detail=f"Sub-category '{a.sub_category}' not found in category {dictCat['name']}"
                )

        # Resolve category names for storage
        lsResolvedAllowances = []
        for a in lsAllowances:
            dictCat = objCategories.find_one({"_id": ObjectId(a.category_id)}, {"name": 1})
            lsResolvedAllowances.append({
                "category_id": a.category_id,
                "category_name": dictCat["name"],
                "sub_category": a.sub_category,
            })

        objUsers.update_one({"_id": ObjectId(user_id)}, {"$set": {"default_allowances": lsResolvedAllowances}})

        dictNew = objUsers.find_one({"_id": ObjectId(user_id)})
        dictNew["user_id"] = str(dictNew.pop("_id"))

        logMutation("users", dictOld, dictNew, "UPDATE_CATEGORIES", dictCurrentUser["user_id"], user_id)

        return UserResponseSchema(**dictNew)

    except HTTPException:
        raise
    except Exception as objErr:
        objLogger.error(f"❌ UPDATE CATEGORIES ERROR: {objErr}")
        raise HTTPException(status_code=500, detail=str(objErr))


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def deleteUser(
    user_id: str,
    dictCurrentUser: dict = Depends(getOwnerUserDependency),
):
    """
    Purpose : Soft-delete a user by setting their "is_active" status to False.

    Inputs  : (1) user_id: The ID of the user to delete (path parameter).
              (2) dictCurrentUser: The currently authenticated owner user performing the operation (injected by dependency).
    
    Output  : None (204 No Content response).
    
    Access  : Owner only.
    """
    try:
        objUsers = get_collection("users")
        dictOld = objUsers.find_one({"_id": ObjectId(user_id)})

        if not dictOld:
            raise HTTPException(status_code=404, detail="User not found")

        objUsers.update_one({"_id": ObjectId(user_id)}, {"$set": {"is_active": False}})

        dictNew = dictOld.copy()
        dictNew["is_active"] = False

        logMutation("users", dictOld, dictNew, "DELETE", dictCurrentUser["user_id"], user_id)

        return None

    except HTTPException:
        raise
    except Exception as objErr:
        objLogger.error(f"❌ DELETE USER ERROR: {objErr}")
        raise HTTPException(status_code=500, detail=str(objErr))
        raise HTTPException(status_code=500, detail=str(objErr))
