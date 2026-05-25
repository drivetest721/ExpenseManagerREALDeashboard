"""
Purpose : Phase 2 integration tests for Authentication routes.
          Uses FastAPI TestClient + mongomock to run entirely offline.

          Covers:
            - POST /api/auth/login  (happy path, wrong password, unknown email)
            - POST /api/auth/logout (valid token, no token)
            - GET  /api/auth/me     (valid token, expired token)

Run     : cd c:\\aryan\\ExpenseManager
          .venv\\Scripts\\python.exe -m pytest "API Test/auth_routes/Test/test.py" -v

Dependencies: pytest, httpx, mongomock, passlib[bcrypt]
"""

import sys
import os
from datetime import datetime, timezone, timedelta
from unittest.mock import patch, MagicMock

import pytest
from fastapi.testclient import TestClient
from bson import ObjectId
from jose import jwt

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "..", "sourcecode"))

# ── Fixtures ──────────────────────────────────────────────────────────────────

_FAKE_USER_ID = str(ObjectId())
# Use a dummy hash placeholder — password verification is mocked in the fixture
_FAKE_PASSWORD_HASH = "$2b$12$PLACEHOLDER_HASH_FOR_TESTING_ONLY"

_FAKE_USER = {
    "_id": ObjectId(_FAKE_USER_ID),
    "email": "john.doe@example.com",
    "name": "John Doe",
    "employee_id": "EMP001",
    "password_hash": _FAKE_PASSWORD_HASH,
    "departments": [
        {"department_id": ObjectId(), "role": "employee", "is_primary": True}
    ],
    "managers": [],
    "is_active": True,
    "has_payment_method": False,
}

_JWT_SECRET = "test-secret-key"
_JWT_ALGORITHM = "HS256"


def _makeToken(dictExtra: dict = None, iExpiryMinutes: int = 480) -> str:
    dictPayload = {
        "user_id": _FAKE_USER_ID,
        "email": _FAKE_USER["email"],
        "name": _FAKE_USER["name"],
        "primary_role": "employee",
        "exp": datetime.now(timezone.utc) + timedelta(minutes=iExpiryMinutes),
    }
    if dictExtra:
        dictPayload.update(dictExtra)
    return jwt.encode(dictPayload, _JWT_SECRET, algorithm=_JWT_ALGORITHM)


def _makeExpiredToken() -> str:
    return _makeToken(iExpiryMinutes=-1)


@pytest.fixture(scope="module")
def objClient():
    """TestClient with mocked MongoDB collection and env settings.
    Password verification is mocked so bcrypt is never called (avoids
    passlib/bcrypt compatibility issues on Python 3.13 in test environment).
    """
    with patch("env_config.objSettings") as mockSettings:
        mockSettings.JWT_SECRET_KEY = _JWT_SECRET
        mockSettings.JWT_ALGORITHM = _JWT_ALGORITHM
        mockSettings.JWT_EXPIRY_MINUTES = 480
        mockSettings.MONGODB_URL = "mongodb://localhost:27017"
        mockSettings.MONGODB_DATABASE = "test_db"
        mockSettings.APP_NAME = "TestApp"
        mockSettings.APP_ENV = "test"
        mockSettings.lsStrCorsOrigins = ["http://localhost:5173"]

        with patch("config.mongodb_config.get_collection") as mockGetCollection:
            mockUsersCol = MagicMock()

            def _find_one(query):
                if query.get("email") == _FAKE_USER["email"]:
                    return _FAKE_USER
                _id_val = query.get("_id")
                if _id_val and str(_id_val) == _FAKE_USER_ID:
                    return _FAKE_USER
                return None

            mockUsersCol.find_one.side_effect = _find_one

            def _col_side_effect(name):
                if name == "users":
                    return mockUsersCol
                return MagicMock()

            mockGetCollection.side_effect = _col_side_effect

            # Mock _verifyPassword so bcrypt is never called
            with patch("routes.auth_routes._verifyPassword") as mockVerifyPw, \
                 patch("config.mongodb_config.ping_mongo", return_value=True), \
                 patch("config.mongodb_config.ensure_indexes", return_value=None):

                # Returns True only for the correct password "secret123"
                mockVerifyPw.side_effect = lambda plain, hashed: plain == "secret123"

                from main import objApp
                with TestClient(objApp) as client:
                    yield client


# ── Login tests ───────────────────────────────────────────────────────────────

def test_login_happy_path(objClient):
    objResp = objClient.post("/api/auth/login", json={
        "email": "john.doe@example.com",
        "password": "secret123",
    })
    assert objResp.status_code == 200
    dictData = objResp.json()
    assert dictData["success"] is True
    assert "access_token" in dictData
    assert dictData["user"]["email"] == "john.doe@example.com"
    assert dictData["token_type"] == "bearer"


def test_login_wrong_password(objClient):
    objResp = objClient.post("/api/auth/login", json={
        "email": "john.doe@example.com",
        "password": "wrongpassword",
    })
    assert objResp.status_code == 401
    assert "Invalid" in objResp.json()["detail"]


def test_login_unknown_email(objClient):
    objResp = objClient.post("/api/auth/login", json={
        "email": "nobody@example.com",
        "password": "secret123",
    })
    assert objResp.status_code == 401


def test_login_invalid_email_format(objClient):
    objResp = objClient.post("/api/auth/login", json={
        "email": "not-an-email",
        "password": "secret123",
    })
    assert objResp.status_code == 422   # Pydantic validation error


# ── /me tests ─────────────────────────────────────────────────────────────────

def test_get_me_valid_token(objClient):
    strToken = _makeToken()
    objResp = objClient.get("/api/auth/me", headers={"Authorization": f"Bearer {strToken}"})
    assert objResp.status_code == 200
    assert objResp.json()["user"]["email"] == "john.doe@example.com"


def test_get_me_expired_token(objClient):
    strToken = _makeExpiredToken()
    objResp = objClient.get("/api/auth/me", headers={"Authorization": f"Bearer {strToken}"})
    assert objResp.status_code == 401


def test_get_me_no_token(objClient):
    objResp = objClient.get("/api/auth/me")
    assert objResp.status_code == 401   # HTTPBearer returns 401 when no credentials


# ── Logout tests ──────────────────────────────────────────────────────────────

def test_logout_valid_token(objClient):
    strToken = _makeToken()
    objResp = objClient.post("/api/auth/logout", headers={"Authorization": f"Bearer {strToken}"})
    assert objResp.status_code == 200
    assert objResp.json()["success"] is True


def test_logout_no_token(objClient):
    objResp = objClient.post("/api/auth/logout")
    assert objResp.status_code == 401
