"""
Purpose : Phase 3 integration tests for Department routes.
          Uses FastAPI TestClient + mongomock to run entirely offline.

Run     : .venv\\Scripts\\python.exe -m pytest "API Test/department_routes/Test/test.py" -v
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

_FAKE_ADMIN_ID = str(ObjectId())
_FAKE_OWNER_ID = str(ObjectId())

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

        # Pre-seed users for auth
        objDb.users.insert_one({
            "_id": ObjectId(_FAKE_ADMIN_ID),
            "name": "CA User",
            "email": "ca@example.com",
            "departments": [{"role": "ca", "is_primary": True}],
            "is_active": True
        })
        objDb.users.insert_one({
            "_id": ObjectId(_FAKE_OWNER_ID),
            "name": "Owner User",
            "email": "owner@example.com",
            "departments": [{"role": "owner", "is_primary": True}],
            "is_active": True
        })

        # Patch get_collection in all modules that use it to ensure they use our mongomock
        with patch("config.mongodb_config.get_collection", side_effect=lambda name: objDb[name]), \
             patch("middleware.jwt_middleware.get_collection", side_effect=lambda name: objDb[name]), \
             patch("routes.department_routes.get_collection", side_effect=lambda name: objDb[name]):

            with patch("config.mongodb_config.ping_mongo", return_value=True), \
                 patch("config.mongodb_config.ensure_indexes", return_value=None), \
                 patch("controllers.AuditLogger.logMutation", return_value="audit_id"):

                from main import objApp
                # Force re-import or reload might be needed but let's try TestClient first
                with TestClient(objApp) as client:
                    yield client, objDb

def test_create_department(objClient):
    client, objDb = objClient
    strToken = _makeToken(_FAKE_ADMIN_ID, "ca")

    objResp = client.post("/api/departments/create",
                          json={"department_name": "Engineering", "owner_ids": []},
                          headers={"Authorization": f"Bearer {strToken}"})

    assert objResp.status_code == 201
    assert objResp.json()["department_name"] == "Engineering"
    assert objDb.departments.find_one({"department_name": "Engineering"}) is not None

def test_list_departments(objClient):
    client, objDb = objClient
    strToken = _makeToken(_FAKE_ADMIN_ID, "employee")

    objDb.departments.insert_one({"department_name": "HR", "owner_ids": [], "is_active": True})

    objResp = client.get("/api/departments/list", headers={"Authorization": f"Bearer {strToken}"})
    assert objResp.status_code == 200
    assert len(objResp.json()) == 1
    assert objResp.json()[0]["department_name"] == "HR"

def test_delete_department_owner_only(objClient):
    client, objDb = objClient
    strDeptId = str(ObjectId())
    objDb.departments.insert_one({"_id": ObjectId(strDeptId), "department_name": "Test", "is_active": True})

    # Try with non-owner
    strTokenCa = _makeToken(_FAKE_ADMIN_ID, "ca")
    objResp = client.delete(f"/api/departments/{strDeptId}", headers={"Authorization": f"Bearer {strTokenCa}"})
    assert objResp.status_code == 403

    # Try with owner
    strTokenOwner = _makeToken(_FAKE_OWNER_ID, "owner")
    objResp = client.delete(f"/api/departments/{strDeptId}", headers={"Authorization": f"Bearer {strTokenOwner}"})
    assert objResp.status_code == 204
    assert objDb.departments.find_one({"_id": ObjectId(strDeptId)})["is_active"] is False
