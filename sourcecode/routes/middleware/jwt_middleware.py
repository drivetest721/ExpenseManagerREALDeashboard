'''
Purpose : JWT authentication middleware providing FastAPI Depends helpers.
          Every protected route imports one of these helpers via Depends().

          Helpers:
            getCurrentUserDependency  — any active user
            getAdminUserDependency    — owner or CA only (admin-level)
            getOwnerUserDependency    — owner only
            getCaUserDependency       — CA only

Inputs  : Bearer token from Authorization header.

Output  : dict with user_id, email, name, departments, primary_role, is_active.

Dependencies: python-jose, config.mongodb_config, env_config
'''

import logging
import sys
import os
import traceback
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from bson import ObjectId

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from env_config import objSettings
from config.mongodb_config import get_collection

objLogger = logging.getLogger(__name__)

_objBearer = HTTPBearer(auto_error=True)

# Roles considered "admin" for access control purposes
_ADMIN_ROLES = {"owner"}
_OWNER_ROLES = {"owner"}
_CA_ROLES = {"ca"}


def _decodeToken(strToken: str) -> dict:
    """
    Purpose : Decode and validate a JWT access token.

    Inputs  :   (1) strToken : Raw JWT string from the Authorization header.

    Output  : Decoded payload dict (user_id, email, primary_role, …).

    Example : dictPayload = _decodeToken(strRawToken)
    """
    try:
        dictPayload = jwt.decode(
            strToken,
            objSettings.JWT_SECRET_KEY,
            algorithms=[objSettings.JWT_ALGORITHM],
        )
        return dictPayload
    except JWTError as objErr:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired token: {objErr}",
            headers={"WWW-Authenticate": "Bearer"},
        )


def _fetchLiveUser(strUserId: str) -> dict:
    """
    Purpose : Load the live user document from MongoDB to confirm the account
              is still active (not deactivated after token issue).

    Inputs  :   (1) strUserId : Hex string of the user _id.

    Output  : MongoDB user document dict.

    Example : dictUser = _fetchLiveUser("66aabc123def456789012345")
    """
    try:
        objUsers = get_collection("users")
        dictUser = objUsers.find_one({"_id": ObjectId(strUserId)})
    except Exception:
        dictUser = None

    if not dictUser:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account not found",
        )
    if not dictUser.get("is_active", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated",
        )
    return dictUser


def _buildCurrentUser(dictPayload: dict, dictUser: dict) -> dict:
    """Build the standard dictCurrentUser returned to route handlers."""
    lsDepts = dictUser.get("departments", [])
    # Primary role: first department with is_primary=True, else first in list
    strPrimaryRole = "employee"
    for dictDept in lsDepts:
        if dictDept.get("is_primary", False):
            strPrimaryRole = dictDept.get("role", "employee")
            break
    if strPrimaryRole == "employee" and lsDepts:
        strPrimaryRole = lsDepts[0].get("role", "employee")

    return {
        "user_id": str(dictUser["_id"]),
        "email": dictUser.get("email", ""),
        "name": dictUser.get("name", ""),
        "employee_id": dictUser.get("employee_id"),
        "departments": dictUser.get("departments", []),
        "managers": dictUser.get("managers", []),
        "primary_role": strPrimaryRole,
        "is_active": dictUser.get("is_active", True),
        "has_payment_method": dictUser.get("has_payment_method", False),
        "ask_public_key": dictUser.get("ask_public_key"),
    }


# ── Public Depends helpers ─────────────────────────────────────────────────────

async def getCurrentUserDependency(
    objCredentials: HTTPAuthorizationCredentials = Depends(_objBearer),
) -> dict:
    """
    Purpose : Validate JWT and return current user dict for any authenticated endpoint.

    Inputs  :   (1) objCredentials : Bearer credentials injected by FastAPI.

    Output  : dictCurrentUser with user_id, email, name, primary_role, etc.

    Example : @router.get("/") async def fn(dictCurrentUser = Depends(getCurrentUserDependency))
    """
    dictPayload = _decodeToken(objCredentials.credentials)
    strUserId: Optional[str] = dictPayload.get("user_id")
    if not strUserId:
        raise HTTPException(status_code=401, detail="Token missing user_id claim")
    dictUser = _fetchLiveUser(strUserId)
    return _buildCurrentUser(dictPayload, dictUser)


async def getAdminUserDependency(
    dictCurrentUser: dict = Depends(getCurrentUserDependency),
) -> dict:
    """
    Purpose : Restrict endpoint to owner or CA roles.

    Inputs  :   (1) dictCurrentUser : Injected by getCurrentUserDependency.

    Output  : Same dictCurrentUser if authorised; raises 403 otherwise.

    Example : @router.delete("/") async def fn(u = Depends(getAdminUserDependency))
    """
    if dictCurrentUser["primary_role"] not in _ADMIN_ROLES:
        raise HTTPException(status_code=403, detail="Admin access required")
    return dictCurrentUser


async def getOwnerUserDependency(
    dictCurrentUser: dict = Depends(getCurrentUserDependency),
) -> dict:
    """
    Purpose : Restrict endpoint to owner role only.

    Inputs  :   (1) dictCurrentUser : Injected by getCurrentUserDependency.

    Output  : Same dictCurrentUser if authorised; raises 403 otherwise.

    Example : @router.put("/settings") async def fn(u = Depends(getOwnerUserDependency))
    """
    if dictCurrentUser["primary_role"] not in _OWNER_ROLES:
        raise HTTPException(status_code=403, detail="Owner access required")
    return dictCurrentUser


async def getCaUserDependency(
    dictCurrentUser: dict = Depends(getCurrentUserDependency),
) -> dict:
    """
    Purpose : Restrict endpoint to CA (accountant) role only.

    Inputs  :   (1) dictCurrentUser : Injected by getCurrentUserDependency.

    Output  : Same dictCurrentUser if authorised; raises 403 otherwise.

    Example : @router.post("/pay") async def fn(u = Depends(getCaUserDependency))
    """
    if dictCurrentUser["primary_role"] not in _CA_ROLES:
        raise HTTPException(status_code=403, detail="CA access required")
    return dictCurrentUser
