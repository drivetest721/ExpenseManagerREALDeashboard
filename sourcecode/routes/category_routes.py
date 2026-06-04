'''
Purpose : CRUD routes for Reimbursement Categories.
          Owner-only writes; any authenticated user can list active categories.

Inputs  : HTTP requests (JSON bodies for mutations, path params for IDs).

Output  : JSON success/error responses with Category metadata.

Dependencies: fastapi, mongodb_config, jwt_middleware, category_schemas, AuditLogger
'''

import logging
from datetime import datetime, timezone
from typing import List

from bson import ObjectId
from fastapi import APIRouter, HTTPException, status, Depends, Query

from config.mongodb_config import get_collection
from middleware.jwt_middleware import getOwnerUserDependency, getCurrentUserDependency
from schemas.category_schemas import (
    CategoryCreateRequest,
    CategoryUpdateRequest,
    CategoryResponseSchema,
)
from controllers.AuditLogger import logMutation

objLogger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/categories", tags=["Categories"])


# ── helpers ───────────────────────────────────────────────────────────────────

def _docToSchema(dictDoc: dict) -> CategoryResponseSchema:
    """Map a MongoDB document to CategoryResponseSchema."""
    dictDoc = dict(dictDoc)
    dictDoc["category_id"] = str(dictDoc.pop("_id"))
    # Convert ObjectId dept ids stored as strings/ObjectIds
    dictDoc.setdefault("department_ids", [])
    dictDoc.setdefault("sub_categories", [])
    dictDoc.setdefault("allowed_roles", [])
    return CategoryResponseSchema(**dictDoc)


# ── routes ────────────────────────────────────────────────────────────────────

@router.post("/create", response_model=CategoryResponseSchema, status_code=status.HTTP_201_CREATED)
async def createCategory(
    objRequest: CategoryCreateRequest,
    dictCurrentUser: dict = Depends(getOwnerUserDependency),
):
    """
    Purpose : Create a new reimbursement category.
    Access  : Owner only.
    """
    try:
        objCats = get_collection("reimbursement_categories")

        if objCats.find_one({"name": objRequest.name, "is_active": True}):
            raise HTTPException(status_code=400, detail="A category with this name already exists")

        dictNew = objRequest.model_dump()
        # Convert enums to their values for storage
        dictNew["allowed_roles"] = [r.value for r in objRequest.allowed_roles]
        dictNew["is_active"] = True
        dictNew["created_by"] = dictCurrentUser["user_id"]
        dictNew["created_at"] = datetime.now(timezone.utc).isoformat()

        objResult = objCats.insert_one(dictNew)
        dictNew["_id"] = objResult.inserted_id

        logMutation("reimbursement_categories", None, dictNew, "INSERT", dictCurrentUser["user_id"], str(objResult.inserted_id))

        return _docToSchema(dictNew)

    except HTTPException:
        raise
    except Exception as objErr:
        objLogger.error(f"❌ CREATE CATEGORY ERROR: {objErr}")
        raise HTTPException(status_code=500, detail=str(objErr))


@router.get("/list", response_model=List[CategoryResponseSchema])
async def listCategories(
    include_inactive: bool = Query(False, description="Include inactive categories"),
    dictCurrentUser: dict = Depends(getCurrentUserDependency)
):
    """
    Purpose : List all active categories (or all if include_inactive=true).
    Access  : Any authenticated user.
    """
    try:
        objCats = get_collection("reimbursement_categories")
        query = {} if include_inactive else {"is_active": True}
        lsDocs = list(objCats.find(query))
        return [_docToSchema(d) for d in lsDocs]

    except Exception as objErr:
        objLogger.error(f"❌ LIST CATEGORIES ERROR: {objErr}")
        raise HTTPException(status_code=500, detail=str(objErr))


@router.put("/{category_id}", response_model=CategoryResponseSchema)
async def updateCategory(
    category_id: str,
    objRequest: CategoryUpdateRequest,
    dictCurrentUser: dict = Depends(getOwnerUserDependency),
):
    """
    Purpose : Update an existing category (partial).
    Access  : Owner only.
    """
    try:
        objCats = get_collection("reimbursement_categories")
        dictOld = objCats.find_one({"_id": ObjectId(category_id)})

        if not dictOld:
            raise HTTPException(status_code=404, detail="Category not found")

        dictUpdates = objRequest.model_dump(exclude_unset=True)
        if not dictUpdates:
            raise HTTPException(status_code=400, detail="No updates provided")

        # Serialize enums
        if "allowed_roles" in dictUpdates:
            dictUpdates["allowed_roles"] = [r.value if hasattr(r, "value") else r for r in dictUpdates["allowed_roles"]]

        objCats.update_one({"_id": ObjectId(category_id)}, {"$set": dictUpdates})
        dictNew = objCats.find_one({"_id": ObjectId(category_id)})

        logMutation("reimbursement_categories", dictOld, dictNew, "UPDATE", dictCurrentUser["user_id"], category_id)

        return _docToSchema(dictNew)

    except HTTPException:
        raise
    except Exception as objErr:
        objLogger.error(f"❌ UPDATE CATEGORY ERROR: {objErr}")
        raise HTTPException(status_code=500, detail=str(objErr))


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
async def deleteCategory(
    category_id: str,
    dictCurrentUser: dict = Depends(getOwnerUserDependency),
):
    """
    Purpose : Soft-delete a category.
    Access  : Owner only.
    """
    try:
        objCats = get_collection("reimbursement_categories")
        dictOld = objCats.find_one({"_id": ObjectId(category_id)})

        if not dictOld:
            raise HTTPException(status_code=404, detail="Category not found")

        objCats.update_one({"_id": ObjectId(category_id)}, {"$set": {"is_active": False}})
        dictNew = {**dictOld, "is_active": False}

        logMutation("reimbursement_categories", dictOld, dictNew, "DELETE", dictCurrentUser["user_id"], category_id)

        return None

    except HTTPException:
        raise
    except Exception as objErr:
        objLogger.error(f"❌ DELETE CATEGORY ERROR: {objErr}")
        raise HTTPException(status_code=500, detail=str(objErr))
