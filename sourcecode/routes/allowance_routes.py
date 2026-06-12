'''
Purpose : Read-only allowance views.

  GET /api/allowance/my   — categories the current user is eligible for.
  GET /api/allowance/all  — all active categories with matched assignees
                            (Owner / CA only).

Inputs  : JWT token (current user context).

Output  : JSON responses with category details and optional assignee lists.

Dependencies: fastapi, mongodb_config, jwt_middleware, category_schemas
'''

import logging
from typing import List

from bson import ObjectId
from fastapi import APIRouter, HTTPException, Depends

from config.mongodb_config import get_collection
from middleware.jwt_middleware import getCurrentUserDependency, getAdminUserDependency
from schemas.category_schemas import (
    CategoryResponseSchema,
    AllowanceWithAssigneesSchema,
    AssigneeSchema,
)

objLogger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/allowance", tags=["Allowance"])


# ── helpers ───────────────────────────────────────────────────────────────────

def _docToCategory(dictDoc: dict) -> dict:
    """
    purpose : Convert a raw reimbursement_categories doc to a JSON-safe dict.
    Also ensures certain fields are always present for the response schema.

    Inputs  : dictDoc from MongoDB.

    Output  : dict with stringified category_id and defaulted fields.
    """
    dictDoc = dict(dictDoc)
    dictDoc["category_id"] = str(dictDoc.pop("_id"))
    dictDoc.setdefault("department_ids", [])
    dictDoc.setdefault("sub_categories", [])
    dictDoc.setdefault("allowed_roles", [])
    return dictDoc


def _userMatchesCategory(dictUser: dict, dictCat: dict) -> bool:
    """
    Purpose : Determine if a user matches the eligibility criteria of a category.
    This is used to determine if a category should be included in the "my allowance" view for a user.

    Inputs  :   (1) dictUser : User document from MongoDB.
                (2) dictCat  : Category document from MongoDB.

    Output  : True if user matches category criteria, False otherwise.

    Matching rules:
        - If category.allowed_roles is non-empty, user must have at least one matching role in their departments.
        - If category.department_ids is non-empty, user must belong to at least one of those departments.
        - If both criteria are present, user must satisfy both to be eligible.
    """

    lsAllowedRoles = dictCat.get("allowed_roles", [])
    lsDeptIds = dictCat.get("department_ids", [])

    # Collect all roles the user holds across departments
    lsUserRoles = [d.get("role") for d in dictUser.get("departments", [])]
    lsUserDeptIds = [str(d.get("department_id", "")) for d in dictUser.get("departments", [])]

    bRoleMatch = not lsAllowedRoles or any(r in lsAllowedRoles for r in lsUserRoles)
    bDeptMatch = not lsDeptIds or any(d in lsDeptIds for d in lsUserDeptIds)

    return bRoleMatch and bDeptMatch


# ── routes ────────────────────────────────────────────────────────────────────

@router.get("/my", response_model=List[CategoryResponseSchema])
async def getMyAllowance(dictCurrentUser: dict = Depends(getCurrentUserDependency)):
    """
    Purpose : Return categories the current user is eligible for.

    Inputs  : JWT token (current user context).
    
    Output  : List of category details (CategoryResponseSchema).
    
    Access  : Any authenticated user.
    """
    try:
        objCats = get_collection("reimbursement_categories")
        objUsers = get_collection("users")

        dictLiveUser = objUsers.find_one({"_id": ObjectId(dictCurrentUser["user_id"])})
        if not dictLiveUser:
            raise HTTPException(status_code=404, detail="User not found")

        lsResult = []
        for dictCat in objCats.find({"is_active": True}):
            if _userMatchesCategory(dictLiveUser, dictCat):
                lsResult.append(CategoryResponseSchema(**_docToCategory(dictCat)))

        return lsResult

    except HTTPException:
        raise
    except Exception as objErr:
        objLogger.error(f"❌ MY ALLOWANCE ERROR: {objErr}")
        raise HTTPException(status_code=500, detail=str(objErr))


@router.get("/all", response_model=List[AllowanceWithAssigneesSchema])
async def getAllAllowance(dictCurrentUser: dict = Depends(getAdminUserDependency)):
    """
    Purpose : Return all active categories with their matched assignees.

    Inputs  : JWT token (current user context).
    
    Output  : List of category details with assignees (AllowanceWithAssigneesSchema).

    Access  : Admin (Owner / CA) only.
    """
    try:
        objCats = get_collection("reimbursement_categories")
        objUsers = get_collection("users")
        objDepts = get_collection("departments")

        # Build a lookup: department_id → department_name
        dictDeptNames: dict = {}
        for dictDept in objDepts.find({"is_active": True}):
            dictDeptNames[str(dictDept["_id"])] = dictDept.get("department_name", "")

        lsAllUsers = list(objUsers.find({"is_active": True}))
        lsResult = []

        for dictCat in objCats.find({"is_active": True}):
            dictCatOut = _docToCategory(dictCat)

            lsAssignees: List[AssigneeSchema] = []
            for dictUser in lsAllUsers:
                if _userMatchesCategory(dictUser, dictCat):
                    # Pick the primary department entry for display
                    lsDeptEntries = dictUser.get("departments", [])
                    dictPrimary = next((d for d in lsDeptEntries if d.get("is_primary")), lsDeptEntries[0] if lsDeptEntries else {})
                    strDeptId = str(dictPrimary.get("department_id", ""))
                    lsAssignees.append(AssigneeSchema(
                        user_id=str(dictUser["_id"]),
                        name=dictUser.get("name", ""),
                        email=dictUser.get("email", ""),
                        role=dictPrimary.get("role", "employee"),
                        department_id=strDeptId or None,
                        department_name=dictDeptNames.get(strDeptId) or None,
                    ))

            lsResult.append(AllowanceWithAssigneesSchema(**dictCatOut, assignees=lsAssignees))

        return lsResult

    except HTTPException:
        raise
    except Exception as objErr:
        objLogger.error(f"❌ ALL ALLOWANCE ERROR: {objErr}")
        raise HTTPException(status_code=500, detail=str(objErr))
