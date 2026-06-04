'''
Purpose : CRUD routes for Departments — list, create, update, and soft-delete.

Inputs  : HTTP requests (JSON bodies for mutations, path params for IDs).

Output  : JSON success/error responses with Department metadata.

Dependencies: fastapi, mongodb_config, jwt_middleware, department_schemas, AuditLogger
'''

import logging
from typing import List
from fastapi import APIRouter, HTTPException, status, Depends, Query
from bson import ObjectId

from config.mongodb_config import get_collection
from middleware.jwt_middleware import getAdminUserDependency, getOwnerUserDependency, getCurrentUserDependency
from schemas.department_schemas import (
    DepartmentCreateRequest,
    DepartmentUpdateRequest,
    DepartmentResponseSchema,
)
from controllers.AuditLogger import logMutation

objLogger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/departments", tags=["Departments"])


@router.post("/create", response_model=DepartmentResponseSchema, status_code=status.HTTP_201_CREATED)
async def createDepartment(
    objRequest: DepartmentCreateRequest,
    dictCurrentUser: dict = Depends(getAdminUserDependency),
):
    """
    Purpose : Create a new department.
    Access  : Admin (Owner).
    """
    try:
        objDepts = get_collection("departments")

        # Check if department_id already exists
        if objDepts.find_one({"department_id": objRequest.department_id}):
            raise HTTPException(status_code=400, detail="Department ID already exists")

        # Check if department already exists
        if objDepts.find_one({"department_name": objRequest.department_name}):
            raise HTTPException(status_code=400, detail="Department already exists")

        dictNewDept = {
            "department_id": objRequest.department_id,
            "department_name": objRequest.department_name,
            "owner_ids": objRequest.owner_ids,
            "is_active": True,
        }

        objResult = objDepts.insert_one(dictNewDept)
        strId = str(objResult.inserted_id)

        logMutation("departments", None, dictNewDept, "INSERT", dictCurrentUser["user_id"], objRequest.department_id)

        dictNewDept.pop("_id", None)
        return DepartmentResponseSchema(**dictNewDept)

    except HTTPException:
        raise
    except Exception as objErr:
        objLogger.error(f"❌ CREATE DEPT ERROR: {objErr}")
        raise HTTPException(status_code=500, detail=str(objErr))


@router.get("/list", response_model=List[DepartmentResponseSchema])
async def listDepartments(
    include_inactive: bool = Query(False, description="Include inactive departments"),
    dictCurrentUser: dict = Depends(getCurrentUserDependency)
):
    """
    Purpose : List all active departments (or all if include_inactive=true).
    Access  : Any authenticated user.
    """
    try:
        objDepts = get_collection("departments")
        query = {} if include_inactive else {"is_active": True}
        lsDepts = list(objDepts.find(query))

        lsResponse = []
        for dictDept in lsDepts:
            # Provide a fallback for older data that doesn't have department_id
            if "department_id" not in dictDept:
                dictDept["department_id"] = str(dictDept.get("_id"))
            dictDept.pop("_id", None)
            lsResponse.append(DepartmentResponseSchema(**dictDept))

        return lsResponse

    except Exception as objErr:
        objLogger.error(f"❌ LIST DEPT ERROR: {objErr}")
        raise HTTPException(status_code=500, detail=str(objErr))


@router.put("/{department_id}", response_model=DepartmentResponseSchema)
async def updateDepartment(
    department_id: str,
    objRequest: DepartmentUpdateRequest,
    dictCurrentUser: dict = Depends(getAdminUserDependency),
):
    """
    Purpose : Update department name or owners.
    Access  : Admin (Owner).
    """
    try:
        objDepts = get_collection("departments")
        dictOld = objDepts.find_one({"department_id": department_id})
        # Fallback to ObjectId for backward compatibility
        if not dictOld:
            try:
                dictOld = objDepts.find_one({"_id": ObjectId(department_id)})
            except:
                pass

        if not dictOld:
            raise HTTPException(status_code=404, detail="Department not found")

        dictUpdates = objRequest.model_dump(exclude_unset=True)
        if not dictUpdates:
            raise HTTPException(status_code=400, detail="No updates provided")

        objDepts.update_one({"_id": dictOld["_id"]}, {"$set": dictUpdates})

        dictNew = objDepts.find_one({"_id": dictOld["_id"]})
        if "department_id" not in dictNew:
            dictNew["department_id"] = str(dictNew.get("_id"))
        dictNew.pop("_id", None)

        logMutation("departments", dictOld, dictNew, "UPDATE", dictCurrentUser["user_id"], department_id)
        
        return DepartmentResponseSchema(**dictNew)

    except HTTPException:
        raise
    except Exception as objErr:
        objLogger.error(f"❌ UPDATE DEPT ERROR: {objErr}")
        raise HTTPException(status_code=500, detail=str(objErr))


@router.delete("/{department_id}", status_code=status.HTTP_204_NO_CONTENT)
async def deleteDepartment(
    department_id: str,
    dictCurrentUser: dict = Depends(getOwnerUserDependency),
):
    """
    Purpose : Soft-delete a department.
    Access  : Owner only.
    """
    try:
        objDepts = get_collection("departments")
        dictOld = objDepts.find_one({"department_id": department_id})
        if not dictOld:
            try:
                dictOld = objDepts.find_one({"_id": ObjectId(department_id)})
            except:
                pass

        if not dictOld:
            raise HTTPException(status_code=404, detail="Department not found")

        objDepts.update_one({"_id": dictOld["_id"]}, {"$set": {"is_active": False}})
        
        dictNew = dictOld.copy()
        dictNew["is_active"] = False

        logMutation("departments", dictOld, dictNew, "DELETE", dictCurrentUser["user_id"], department_id)
        
        return None

    except HTTPException:
        raise
    except Exception as objErr:
        objLogger.error(f"❌ DELETE DEPT ERROR: {objErr}")
        raise HTTPException(status_code=500, detail=str(objErr))
