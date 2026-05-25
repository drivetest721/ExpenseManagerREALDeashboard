"""
Purpose : Phase 3 integration tests for User routes.
          Uses FastAPI TestClient + mongomock to run entirely offline.

Run     : .venv\\Scripts\\python.exe -m pytest "API Test/user_routes/Test/test.py" -v
"""

import sys
import os
from unittest.mock import patch, MagicMock
import pytest
from fastapi.testclient import TestClient
from bson import ObjectId
from jose import jwt
from datetime import datetime, timezone, timedelta

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "..", "sourcecode"))

_FAKE_OWNER_ID = str(ObjectId())
_FAKE_USER_ID = str(ObjectId())

_JWT_SECRET = "test-secret-key"
_JWT_ALGORITHM = "HS256"

def _makeToken(strUserId: str, strRole: str) -> str:
    dictPayload = {
        "user_id": strUserId,
        "email": f"{strRole}@example.com",
        "name": strRole.capitalize(),
        "primary_role": strRole,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=480),
    }
    return jwt.encode(dictPayload, _JWT_SECRET, algorithm=_JWT_ALGORITHM)

import mongomock

@pytest.fixture
def objClient():
    with patch("env_config.objSettings") as mockSettings:
        mockSettings.JWT_SECRET_KEY = _JWT_SECRET
        mockSettings.JWT_ALGORITHM = _JWT_ALGORITHM
        mockSettings.MONGODB_URL = "mongodb://localhost:27017"
        mockSettings.MONGODB_DATABASE = "test_db"

        # Setup mongomock
        objMongoClient = mongomock.MongoClient()
        objDb = objMongoClient.test_db

        # Pre-seed users
        objDb.users.insert_one({
            "_id": ObjectId(_FAKE_OWNER_ID),
            "name": "Owner",
            "email": "owner@example.com",
            "departments": [{"department_id": str(ObjectId()), "role": "owner", "is_primary": True}],
            "is_active": True
        })
        objDb.users.insert_one({
            "_id": ObjectId(_FAKE_USER_ID),
            "name": "User",
            "email": "user@example.com",
            "departments": [{"department_id": str(ObjectId()), "role": "employee", "is_primary": True}],
            "is_active": True
        })

        # Patch get_collection in all modules that use it
        with patch("config.mongodb_config.get_collection", side_effect=lambda name: objDb[name]), \
             patch("middleware.jwt_middleware.get_collection", side_effect=lambda name: objDb[name]), \
             patch("routes.user_routes.get_collection", side_effect=lambda name: objDb[name]), \
             patch("routes.user_routes._hashPassword", return_value="hashed_password"):

            with patch("config.mongodb_config.ping_mongo", return_value=True), \
                 patch("config.mongodb_config.ensure_indexes", return_value=None), \
                 patch("controllers.AuditLogger.logMutation", return_value="audit_id"):

                from main import objApp
                with TestClient(objApp) as client:
                    yield client, objDb

def test_create_user(objClient):
    client, objDb = objClient
    strToken = _makeToken(_FAKE_OWNER_ID, "owner")

    objResp = client.post("/api/users/create",
                          json={
                              "employee_id": "EMP123",
                              "name": "New User",
                              "email": "new@example.com",
                              "password": "password123",
                              "departments": [],
                              "managers": []
                          },
                          headers={"Authorization": f"Bearer {strToken}"})

    assert objResp.status_code == 201
    assert objResp.json()["email"] == "new@example.com"
    assert objDb.users.find_one({"email": "new@example.com"}) is not None

def test_update_managers_validation(objClient):
    client, objDb = objClient
    strToken = _makeToken(_FAKE_OWNER_ID, "owner")

    # Test self-management
    objResp = client.put(f"/api/users/{_FAKE_USER_ID}/managers",
                         json={"managers": [{"manager_id": _FAKE_USER_ID, "priority": 1, "approval_type": "mandatory"}]},
                         headers={"Authorization": f"Bearer {strToken}"})
    assert objResp.status_code == 400
    assert "cannot manage themselves" in objResp.json()["detail"]

def test_list_users(objClient):
    client, objDb = objClient
    strToken = _makeToken(_FAKE_USER_ID, "employee")

    objResp = client.get("/api/users/list", headers={"Authorization": f"Bearer {strToken}"})
    assert objResp.status_code == 200
    assert len(objResp.json()) >= 1 # At least the seeded users
