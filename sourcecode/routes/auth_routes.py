'''
Purpose : Authentication routes — login, logout, and current-user profile.

Inputs  : HTTP requests (JSON body for login, Bearer token for /me and /logout).

Output  : JWT token on successful login; user profile on /me.

Dependencies: fastapi, mongodb_config, jwt_middleware, auth_schemas, bcrypt, jose
'''

import logging
import sys
import os
import secrets
import traceback
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, HTTPException, status, Depends
from jose import jwt
import bcrypt

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config.mongodb_config import get_collection
from middleware.jwt_middleware import getCurrentUserDependency
from schemas.auth_schemas import (
    LoginRequestSchema,
    LoginResponseSchema,
    MeResponseSchema,
    LogoutResponseSchema,
    UserProfileSchema,
    DepartmentEntrySchema,
    ManagerEntrySchema,
    SignupRequestSchema,
    SignupResponseSchema,
    VerifyEmailRequestSchema,
    ResendCodeRequestSchema,
    ResendCodeResponseSchema,
)
from utils.email_service import sendVerificationEmail
from env_config import objSettings

objLogger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

# ── Signup verification config ────────────────────────────────────────────────
_VERIFICATION_CODE_TTL_MINUTES = 10
_VERIFICATION_MAX_ATTEMPTS = 5


# ── Helpers ────────────────────────────────────────────────────────────────────

def _toBcryptBytes(strPlain: str) -> bytes:
    """Encode to UTF-8 and truncate to 72 bytes — bcrypt's hard limit."""
    return strPlain.encode("utf-8")[:72]


def _verifyPassword(strPlain: str, strHashed: str) -> bool:
    try:
        return bcrypt.checkpw(_toBcryptBytes(strPlain), strHashed.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def _hashPassword(strPlain: str) -> str:
    return bcrypt.hashpw(_toBcryptBytes(strPlain), bcrypt.gensalt()).decode("utf-8")


def _generateVerificationCode() -> str:
    """Generate a cryptographically-random 6-digit numeric code."""
    return f"{secrets.randbelow(1_000_000):06d}"


def _createAccessToken(dictData: dict) -> str:
    """
    Purpose : Sign a JWT access token with expiry.

    Inputs  :   (1) dictData : Claims to embed (must include user_id, email).

    Output  : Signed JWT string.

    Example : strToken = _createAccessToken({"user_id": "abc", "email": "x@y.com"})
    """
    dictToEncode = dictData.copy()
    dtExpiry = datetime.now(timezone.utc) + timedelta(minutes=objSettings.JWT_EXPIRY_MINUTES)
    dictToEncode["exp"] = dtExpiry
    return jwt.encode(dictToEncode, objSettings.JWT_SECRET_KEY, algorithm=objSettings.JWT_ALGORITHM)


def _buildUserProfile(dictUser: dict) -> UserProfileSchema:
    """Build a UserProfileSchema from a raw MongoDB user document."""
    lsDeptEntries = []
    for dictDept in dictUser.get("departments", []):
        lsDeptEntries.append(
            DepartmentEntrySchema(
                department_id=str(dictDept.get("department_id", "")),
                department_name=dictDept.get("department_name"),
                role=dictDept.get("role", "employee"),
                is_primary=dictDept.get("is_primary", False),
            )
        )

    lsMgrEntries = []
    for dictMgr in dictUser.get("managers", []):
        lsMgrEntries.append(
            ManagerEntrySchema(
                manager_id=str(dictMgr.get("manager_id", "")),
                manager_name=dictMgr.get("manager_name"),
                priority=dictMgr.get("priority", 1),
                approval_type=dictMgr.get("approval_type", "mandatory"),
            )
        )

    return UserProfileSchema(
        user_id=str(dictUser["_id"]),
        employee_id=dictUser.get("employee_id"),
        name=dictUser.get("name", ""),
        email=dictUser.get("email", ""),
        departments=lsDeptEntries,
        managers=lsMgrEntries,
        is_active=dictUser.get("is_active", True),
        has_payment_method=dictUser.get("has_payment_method", False),
        ask_public_key=dictUser.get("ask_public_key"),
    )


# ── Routes ─────────────────────────────────────────────────────────────────────

@router.post("/login", response_model=LoginResponseSchema, status_code=status.HTTP_200_OK)
async def login(objRequest: LoginRequestSchema):
    """
    Purpose : Authenticate a user with email + password and issue a JWT.

    Inputs  :   (1) objRequest : LoginRequestSchema — email and password.

    Output  : LoginResponseSchema — JWT token + user profile.

    Example : POST /api/auth/login
              Body: {"email": "john@example.com", "password": "secret"}
              Response: {"success": true, "access_token": "eyJ...", "user": {...}}
    """
    try:
        objLogger.info(f"📥 LOGIN ATTEMPT | email={objRequest.email}")

        objUsers = get_collection("users")
        dictUser = objUsers.find_one({"email": objRequest.email.lower()})

        if not dictUser:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password",
            )

        if not dictUser.get("is_active", True):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your account has been deactivated. Contact admin.",
            )

        if not _verifyPassword(objRequest.password, dictUser.get("password_hash", "")):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password",
            )

        # Determine primary role for token claim
        strPrimaryRole = "employee"
        for dictDept in dictUser.get("departments", []):
            if dictDept.get("is_primary", False):
                strPrimaryRole = dictDept.get("role", "employee")
                break

        strToken = _createAccessToken({
            "user_id": str(dictUser["_id"]),
            "email": dictUser["email"],
            "name": dictUser.get("name", ""),
            "primary_role": strPrimaryRole,
        })

        objLogger.info(f"✅ LOGIN SUCCESS | email={objRequest.email} | role={strPrimaryRole}")

        return LoginResponseSchema(
            access_token=strToken,
            expires_in=objSettings.JWT_EXPIRY_MINUTES * 60,
            user=_buildUserProfile(dictUser),
        )

    except HTTPException:
        raise
    except Exception as objErr:
        objLogger.error(f"❌ LOGIN ERROR: {objErr}")
        objLogger.error(traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Login failed: {objErr}",
        )


@router.post("/logout", response_model=LogoutResponseSchema, status_code=status.HTTP_200_OK)
async def logout(dictCurrentUser: dict = Depends(getCurrentUserDependency)):
    """
    Purpose : Invalidate the current session (client-side token removal).
              Server-side JWT is stateless; client must discard the token.

    Inputs  :   (1) dictCurrentUser : Injected by getCurrentUserDependency.

    Output  : LogoutResponseSchema — success confirmation.

    Example : POST /api/auth/logout   Headers: Authorization: Bearer <token>
    """
    objLogger.info(f"📥 LOGOUT | user={dictCurrentUser.get('email')}")
    return LogoutResponseSchema()


@router.get("/me", response_model=MeResponseSchema, status_code=status.HTTP_200_OK)
async def getMe(dictCurrentUser: dict = Depends(getCurrentUserDependency)):
    """
    Purpose : Return the authenticated user's full profile.

    Inputs  :   (1) dictCurrentUser : Injected by getCurrentUserDependency.

    Output  : MeResponseSchema — current user profile.

    Example : GET /api/auth/me   Headers: Authorization: Bearer <token>
              Response: {"success": true, "user": {...}}
    """
    try:
        objLogger.info(f"📥 GET ME | user={dictCurrentUser.get('email')}")
        from bson import ObjectId
        objUsers = get_collection("users")
        dictUser = objUsers.find_one({"_id": ObjectId(dictCurrentUser["user_id"])})
        if not dictUser:
            raise HTTPException(status_code=404, detail="User not found")

        objLogger.info(f"✅ GET ME SUCCESS | user={dictCurrentUser.get('email')}")
        return MeResponseSchema(user=_buildUserProfile(dictUser))

    except HTTPException:
        raise
    except Exception as objErr:
        objLogger.error(f"❌ GET ME ERROR: {objErr}")
        objLogger.error(traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching profile: {objErr}",
        )



# ── Signup + Email Verification ───────────────────────────────────────────────

@router.post("/signup", response_model=SignupResponseSchema, status_code=status.HTTP_200_OK)
async def signup(objRequest: SignupRequestSchema):
    """
    Purpose : Begin user registration. Stores a pending_signups record with
              the hashed password and a 6-digit verification code, then emails
              the code to the user. Code expires after _VERIFICATION_CODE_TTL_MINUTES.

    Inputs  :   (1) objRequest : SignupRequestSchema — name, email, password, employee_id?

    Output  : SignupResponseSchema — confirmation + expiry.

    Example : POST /api/auth/signup
              Body: {"name":"Jane","email":"j@x.com","password":"pw1234"}
    """
    try:
        strEmail = objRequest.email.lower()
        objLogger.info(f"📥 SIGNUP ATTEMPT | email={strEmail}")

        objUsers = get_collection("users")
        if objUsers.find_one({"email": strEmail}):
            raise HTTPException(status_code=409, detail="An account with this email already exists")

        objPending = get_collection("pending_signups")
        strCode = _generateVerificationCode()
        dtExpiry = datetime.now(timezone.utc) + timedelta(minutes=_VERIFICATION_CODE_TTL_MINUTES)

        dictPending = {
            "email": strEmail,
            "name": objRequest.name,
            "employee_id": objRequest.employee_id,
            "password_hash": _hashPassword(objRequest.password),
            "code_hash": _hashPassword(strCode),
            "attempts": 0,
            "expires_at": dtExpiry,
            "created_at": datetime.now(timezone.utc),
        }
        # Upsert so re-running signup with the same email refreshes the code.
        objPending.replace_one({"email": strEmail}, dictPending, upsert=True)

        await sendVerificationEmail(strEmail, strCode, _VERIFICATION_CODE_TTL_MINUTES)
        objLogger.info(f"✅ SIGNUP CODE SENT | email={strEmail}")

        return SignupResponseSchema(
            email=strEmail,
            expires_in=_VERIFICATION_CODE_TTL_MINUTES * 60,
        )

    except HTTPException:
        raise
    except Exception as objErr:
        objLogger.error(f"❌ SIGNUP ERROR: {objErr}")
        objLogger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Signup failed: {objErr}")


@router.post("/verify-email", response_model=LoginResponseSchema, status_code=status.HTTP_200_OK)
async def verifyEmail(objRequest: VerifyEmailRequestSchema):
    """
    Purpose : Verify a signup OTP. On success, materialises the user document,
              deletes the pending_signups record, and returns a JWT login response.

    Inputs  :   (1) objRequest : VerifyEmailRequestSchema — email + code.

    Output  : LoginResponseSchema — JWT token + user profile.

    Example : POST /api/auth/verify-email
              Body: {"email":"j@x.com","code":"123456"}
    """
    try:
        strEmail = objRequest.email.lower()
        objLogger.info(f"📥 VERIFY EMAIL | email={strEmail}")

        objPending = get_collection("pending_signups")
        dictPending = objPending.find_one({"email": strEmail})

        if not dictPending:
            raise HTTPException(status_code=404, detail="No pending verification for this email")

        dtExpiry = dictPending.get("expires_at")
        if dtExpiry and dtExpiry.tzinfo is None:
            dtExpiry = dtExpiry.replace(tzinfo=timezone.utc)
        if not dtExpiry or dtExpiry < datetime.now(timezone.utc):
            objPending.delete_one({"email": strEmail})
            raise HTTPException(status_code=410, detail="Verification code expired. Please sign up again.")

        if dictPending.get("attempts", 0) >= _VERIFICATION_MAX_ATTEMPTS:
            objPending.delete_one({"email": strEmail})
            raise HTTPException(status_code=429, detail="Too many invalid attempts. Please sign up again.")

        if not _verifyPassword(objRequest.code, dictPending.get("code_hash", "")):
            objPending.update_one({"email": strEmail}, {"$inc": {"attempts": 1}})
            raise HTTPException(status_code=400, detail="Invalid verification code")

        # Code valid — create the user record (no department/managers; admin assigns later).
        objUsers = get_collection("users")
        if objUsers.find_one({"email": strEmail}):
            objPending.delete_one({"email": strEmail})
            raise HTTPException(status_code=409, detail="An account with this email already exists")

        dictNewUser = {
            "name": dictPending["name"],
            "email": strEmail,
            "employee_id": dictPending.get("employee_id"),
            "password_hash": dictPending["password_hash"],
            "departments": [],
            "managers": [],
            "is_active": True,
            "has_payment_method": False,
            "email_verified_at": datetime.now(timezone.utc),
            "created_at": datetime.now(timezone.utc),
        }
        objResult = objUsers.insert_one(dictNewUser)
        dictNewUser["_id"] = objResult.inserted_id
        objPending.delete_one({"email": strEmail})

        strToken = _createAccessToken({
            "user_id": str(dictNewUser["_id"]),
            "email": strEmail,
            "name": dictNewUser["name"],
            "primary_role": "employee",
        })

        objLogger.info(f"✅ VERIFY EMAIL SUCCESS | email={strEmail}")
        return LoginResponseSchema(
            message="Email verified and account created",
            access_token=strToken,
            expires_in=objSettings.JWT_EXPIRY_MINUTES * 60,
            user=_buildUserProfile(dictNewUser),
        )

    except HTTPException:
        raise
    except Exception as objErr:
        objLogger.error(f"❌ VERIFY EMAIL ERROR: {objErr}")
        objLogger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Verification failed: {objErr}")


@router.post("/resend-code", response_model=ResendCodeResponseSchema, status_code=status.HTTP_200_OK)
async def resendCode(objRequest: ResendCodeRequestSchema):
    """
    Purpose : Generate and email a fresh verification code for an in-flight signup.

    Inputs  :   (1) objRequest : ResendCodeRequestSchema — email.

    Output  : ResendCodeResponseSchema — confirmation + new expiry.

    Example : POST /api/auth/resend-code   Body: {"email":"j@x.com"}
    """
    try:
        strEmail = objRequest.email.lower()
        objLogger.info(f"📥 RESEND CODE | email={strEmail}")

        objPending = get_collection("pending_signups")
        dictPending = objPending.find_one({"email": strEmail})
        if not dictPending:
            raise HTTPException(status_code=404, detail="No pending verification for this email")

        strCode = _generateVerificationCode()
        dtExpiry = datetime.now(timezone.utc) + timedelta(minutes=_VERIFICATION_CODE_TTL_MINUTES)
        objPending.update_one(
            {"email": strEmail},
            {"$set": {
                "code_hash": _hashPassword(strCode),
                "expires_at": dtExpiry,
                "attempts": 0,
            }},
        )

        await sendVerificationEmail(strEmail, strCode, _VERIFICATION_CODE_TTL_MINUTES)
        objLogger.info(f"✅ RESEND CODE SENT | email={strEmail}")

        return ResendCodeResponseSchema(expires_in=_VERIFICATION_CODE_TTL_MINUTES * 60)

    except HTTPException:
        raise
    except Exception as objErr:
        objLogger.error(f"❌ RESEND CODE ERROR: {objErr}")
        objLogger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Resend failed: {objErr}")
