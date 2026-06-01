"""
Purpose : Integration tests for the recently implemented features:
          - Reimbursement draft/submit flow (description field, reimbursement_code in list)
          - Holiday CRUD (Settings Holidays calendar view backend)
          - Category CRUD with department_ids (Settings Categories people-picker)
          - Notification list + mark-read (Notifications inbox)

Run     : cd c:\\aryan\\ExpenseManager
          .venv\\Scripts\\python.exe -m pytest "API Test/reimbursement_routes/Test/test_reimbursement_routes.py" -v

Dependencies: pytest, httpx, mongomock, jose[cryptography]
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

import mongomock

# ── Constants ─────────────────────────────────────────────────────────────────

_JWT_SECRET = "test-secret-key"
_JWT_ALGORITHM = "HS256"

_OWNER_ID = str(ObjectId())
_EMPLOYEE_ID = str(ObjectId())
_MANAGER_ID = str(ObjectId())
_DEPT_ID = str(ObjectId())
_CAT_ID = str(ObjectId())


def _makeToken(strUserId: str, strRole: str = "employee") -> str:
    dictPayload = {
        "user_id": strUserId,
        "email": f"{strRole}@example.com",
        "name": strRole.capitalize(),
        "primary_role": strRole,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=480),
    }
    return jwt.encode(dictPayload, _JWT_SECRET, algorithm=_JWT_ALGORITHM)


@pytest.fixture
def objClient():
    """TestClient with mongomock database, pre-seeded with users, departments, category."""
    with patch("env_config.objSettings") as mockSettings:
        mockSettings.JWT_SECRET_KEY = _JWT_SECRET
        mockSettings.JWT_ALGORITHM = _JWT_ALGORITHM
        mockSettings.JWT_EXPIRY_MINUTES = 480
        mockSettings.MONGODB_URL = "mongodb://localhost:27017"
        mockSettings.MONGODB_DATABASE = "test_db"

        objMongoClient = mongomock.MongoClient()
        objDb = objMongoClient["test_db"]

        # ── Seed users ──────────────────────────────────────────────────────
        objDb["users"].insert_many([
            {
                "_id": ObjectId(_OWNER_ID),
                "name": "Owner User",
                "email": "owner@example.com",
                "employee_id": "EMP001",
                "departments": [{"department_id": _DEPT_ID, "role": "owner", "is_primary": True}],
                "managers": [],
                "is_active": True,
                "has_payment_method": True,
            },
            {
                "_id": ObjectId(_EMPLOYEE_ID),
                "name": "Employee User",
                "email": "employee@example.com",
                "employee_id": "EMP002",
                "departments": [{"department_id": _DEPT_ID, "role": "employee", "is_primary": True}],
                "managers": [{"manager_id": _MANAGER_ID, "priority": 1, "approval_type": "mandatory"}],
                "is_active": True,
                "has_payment_method": True,
            },
            {
                "_id": ObjectId(_MANAGER_ID),
                "name": "Manager User",
                "email": "manager@example.com",
                "employee_id": "EMP003",
                "departments": [{"department_id": _DEPT_ID, "role": "manager", "is_primary": True}],
                "managers": [{"manager_id": _OWNER_ID, "priority": 1, "approval_type": "mandatory"}],
                "is_active": True,
                "has_payment_method": False,
            },
        ])

        # ── Seed category ────────────────────────────────────────────────────
        objDb["reimbursement_categories"].insert_one({
            "_id": ObjectId(_CAT_ID),
            "name": "Travel",
            "max_limit": 5000.0,
            "allowed_roles": ["employee", "manager"],
            "department_ids": [],
            "sub_categories": ["Flight", "Taxi"],
            "requires_invoice": True,
            "approval_required": True,
            "is_active": True,
        })

        # ── Seed departments ─────────────────────────────────────────────────
        objDb["departments"].insert_one({
            "_id": ObjectId(_DEPT_ID),
            "name": "Engineering",
            "is_active": True,
        })

        dictPatches = {
            "config.mongodb_config.get_collection": lambda name: objDb[name],
            "middleware.jwt_middleware.get_collection": lambda name: objDb[name],
            "routes.reimbursement_routes.get_collection": lambda name: objDb[name],
            "routes.holiday_routes.get_collection": lambda name: objDb[name],
            "routes.category_routes.get_collection": lambda name: objDb[name],
            "routes.notification_routes.get_collection": lambda name: objDb[name],
        }

        with patch("config.mongodb_config.ping_mongo", return_value=True), \
             patch("config.mongodb_config.ensure_indexes", return_value=None), \
             patch("controllers.AuditLogger.logMutation", return_value="audit_id"), \
             patch("controllers.ApprovalChainBuilder.buildChain", return_value=[
                 {"user_id": _MANAGER_ID, "name": "Manager User", "email": "manager@example.com",
                  "priority": 1, "approval_type": "mandatory"}
             ]), \
             patch("controllers.ApprovalChainBuilder.snapshotChain", return_value=[
                 {"user_id": _MANAGER_ID, "name": "Manager User", "email": "manager@example.com",
                  "priority": 1, "approval_type": "mandatory", "status": "pending"}
             ]), \
             patch("controllers.NotificationService.notifyAction", return_value=None), \
             patch("controllers.SLAEngine.createSLAEvent", return_value=None), \
             patch("controllers.ReimbursementCounter.getNextReimbursementCode", return_value="RB-2026-000001"), \
             patch("routes.payment_method_routes.hasAnyPaymentMethod", return_value=True):

            with patch("config.mongodb_config.get_collection", side_effect=lambda name: objDb[name]), \
                 patch("middleware.jwt_middleware.get_collection", side_effect=lambda name: objDb[name]), \
                 patch("routes.reimbursement_routes.get_collection", side_effect=lambda name: objDb[name]), \
                 patch("routes.holiday_routes.get_collection", side_effect=lambda name: objDb[name]), \
                 patch("routes.category_routes.get_collection", side_effect=lambda name: objDb[name]), \
                 patch("routes.notification_routes.get_collection", side_effect=lambda name: objDb[name]):

                from main import objApp
                with TestClient(objApp) as client:
                    yield client, objDb


# ─────────────────────────────────────────────────────────────────────────────
# Reimbursement — create draft with description
# ─────────────────────────────────────────────────────────────────────────────

class TestReimbursementDraft:

    def test_create_draft_with_description(self, objClient):
        """POST /api/reimbursements/draft — stores description field."""
        client, objDb = objClient
        strToken = _makeToken(_EMPLOYEE_ID, "employee")

        objResp = client.post(
            "/api/reimbursements/draft",
            json={
                "form_type": "general",
                "description": "Monthly travel expenses for client visit",
                "items": [
                    {
                        "category_id": _CAT_ID,
                        "amount": 1500,
                        "expense_date": "2026-05-15",
                        "attachments": ["attach_001"],
                    }
                ],
            },
            headers={"Authorization": f"Bearer {strToken}"},
        )

        assert objResp.status_code == 201, objResp.text
        dictBody = objResp.json()
        assert dictBody["status"] == "DRAFT"
        assert dictBody["reimbursement_code"] == "RB-2026-000001"
        # description should be persisted and returned
        assert dictBody.get("description") == "Monthly travel expenses for client visit"
        # form_type should normalise to string
        assert dictBody["form_type"] in ("general", "GENERAL")

    def test_create_draft_without_description(self, objClient):
        """POST /api/reimbursements/draft — description is optional."""
        client, objDb = objClient
        strToken = _makeToken(_EMPLOYEE_ID, "employee")

        objResp = client.post(
            "/api/reimbursements/draft",
            json={
                "form_type": "general",
                "items": [
                    {
                        "category_id": _CAT_ID,
                        "amount": 800,
                        "expense_date": "2026-05-20",
                        "attachments": ["attach_002"],
                    }
                ],
            },
            headers={"Authorization": f"Bearer {strToken}"},
        )

        assert objResp.status_code == 201, objResp.text
        dictBody = objResp.json()
        assert dictBody["status"] == "DRAFT"
        # description absent / null is acceptable
        assert dictBody.get("description") in (None, "")

    def test_create_draft_amount_exceeds_limit(self, objClient):
        """POST /api/reimbursements/draft — rejects items exceeding category max_limit."""
        client, objDb = objClient
        strToken = _makeToken(_EMPLOYEE_ID, "employee")

        objResp = client.post(
            "/api/reimbursements/draft",
            json={
                "form_type": "general",
                "items": [
                    {
                        "category_id": _CAT_ID,
                        "amount": 99999,   # way above max_limit of 5000
                        "expense_date": "2026-05-15",
                        "attachments": ["attach_003"],
                    }
                ],
            },
            headers={"Authorization": f"Bearer {strToken}"},
        )

        assert objResp.status_code == 400
        assert "limit" in objResp.json()["detail"].lower()

    def test_create_draft_missing_attachment(self, objClient):
        """POST /api/reimbursements/draft — each item must have ≥1 attachment."""
        client, objDb = objClient
        strToken = _makeToken(_EMPLOYEE_ID, "employee")

        objResp = client.post(
            "/api/reimbursements/draft",
            json={
                "form_type": "general",
                "items": [
                    {
                        "category_id": _CAT_ID,
                        "amount": 200,
                        "expense_date": "2026-05-15",
                        "attachments": [],   # no attachment
                    }
                ],
            },
            headers={"Authorization": f"Bearer {strToken}"},
        )

        assert objResp.status_code == 400
        assert "attachment" in objResp.json()["detail"].lower()


# ─────────────────────────────────────────────────────────────────────────────
# Reimbursement — submit flow (create draft → submit)
# ─────────────────────────────────────────────────────────────────────────────

class TestReimbursementSubmit:

    def test_submit_flow_creates_then_submits(self, objClient):
        """
        Mirrors the fixed useReimbursementSave.ts:
          1. POST /draft → creates with status=DRAFT
          2. POST /:id/submit → transitions to SUBMITTED
        """
        client, objDb = objClient
        strToken = _makeToken(_EMPLOYEE_ID, "employee")

        # Step 1: create draft
        objDraftResp = client.post(
            "/api/reimbursements/draft",
            json={
                "form_type": "general",
                "description": "Submit flow test",
                "items": [
                    {
                        "category_id": _CAT_ID,
                        "amount": 1000,
                        "expense_date": "2026-05-10",
                        "attachments": ["attach_sub_001"],
                    }
                ],
            },
            headers={"Authorization": f"Bearer {strToken}"},
        )
        assert objDraftResp.status_code == 201, objDraftResp.text
        strReimbId = objDraftResp.json()["reimbursement_id"]
        assert objDraftResp.json()["status"] == "DRAFT"

        # Step 2: submit the draft
        objSubmitResp = client.post(
            f"/api/reimbursements/{strReimbId}/submit",
            headers={"Authorization": f"Bearer {strToken}"},
        )
        assert objSubmitResp.status_code == 200, objSubmitResp.text
        assert objSubmitResp.json()["status"] == "SUBMITTED"

    def test_cannot_submit_already_submitted(self, objClient):
        """POST /submit twice should return 400 the second time."""
        client, objDb = objClient
        strToken = _makeToken(_EMPLOYEE_ID, "employee")

        # Create and submit
        objDraftResp = client.post(
            "/api/reimbursements/draft",
            json={
                "form_type": "general",
                "items": [
                    {"category_id": _CAT_ID, "amount": 500, "expense_date": "2026-05-01",
                     "attachments": ["att_x"]}
                ],
            },
            headers={"Authorization": f"Bearer {strToken}"},
        )
        assert objDraftResp.status_code == 201
        strId = objDraftResp.json()["reimbursement_id"]
        client.post(f"/api/reimbursements/{strId}/submit",
                    headers={"Authorization": f"Bearer {strToken}"})

        # Second submit should fail
        objSecondSubmit = client.post(
            f"/api/reimbursements/{strId}/submit",
            headers={"Authorization": f"Bearer {strToken}"},
        )
        assert objSecondSubmit.status_code == 400
        assert "DRAFT" in objSecondSubmit.json()["detail"]


# ─────────────────────────────────────────────────────────────────────────────
# Reimbursement — list endpoint returns reimbursement_code + description
# ─────────────────────────────────────────────────────────────────────────────

class TestReimbursementList:

    def test_list_my_includes_code_and_description(self, objClient):
        """GET /my?bucket=draft — each item now includes reimbursement_code & description."""
        client, objDb = objClient
        strToken = _makeToken(_EMPLOYEE_ID, "employee")

        # Create a draft first
        client.post(
            "/api/reimbursements/draft",
            json={
                "form_type": "general",
                "description": "List test description",
                "items": [
                    {"category_id": _CAT_ID, "amount": 300, "expense_date": "2026-05-25",
                     "attachments": ["att_list_001"]}
                ],
            },
            headers={"Authorization": f"Bearer {strToken}"},
        )

        objResp = client.get("/api/reimbursements/my?bucket=draft",
                             headers={"Authorization": f"Bearer {strToken}"})
        assert objResp.status_code == 200, objResp.text
        lsItems = objResp.json()
        assert len(lsItems) >= 1
        # Verify new fields are present in every item
        for item in lsItems:
            assert "reimbursement_code" in item, "reimbursement_code missing from list item"
            assert "description" in item, "description missing from list item"

    def test_list_requires_auth(self, objClient):
        """GET /my without token → 401/403."""
        client, _ = objClient
        objResp = client.get("/api/reimbursements/my")
        assert objResp.status_code in (401, 403)


# ─────────────────────────────────────────────────────────────────────────────
# Holidays — CRUD (Settings Holidays calendar view)
# ─────────────────────────────────────────────────────────────────────────────

class TestHolidays:

    def test_list_holidays_empty(self, objClient):
        """GET /api/holidays/list — returns empty list when no holidays seeded."""
        client, _ = objClient
        strToken = _makeToken(_EMPLOYEE_ID, "employee")
        objResp = client.get("/api/holidays/list",
                             headers={"Authorization": f"Bearer {strToken}"})
        assert objResp.status_code == 200
        assert isinstance(objResp.json(), list)

    def test_create_holiday(self, objClient):
        """POST /api/holidays/create — owner/admin can add a holiday."""
        client, objDb = objClient
        strToken = _makeToken(_OWNER_ID, "owner")

        objResp = client.post(
            "/api/holidays/create",
            json={"date": "2026-08-15", "name": "Independence Day"},
            headers={"Authorization": f"Bearer {strToken}"},
        )
        assert objResp.status_code == 201, objResp.text
        dictBody = objResp.json()
        assert dictBody["date"] == "2026-08-15"
        assert dictBody["name"] == "Independence Day"
        assert "holiday_id" in dictBody

    def test_create_holiday_duplicate(self, objClient):
        """POST /api/holidays/create — duplicate date returns 409."""
        client, _ = objClient
        strToken = _makeToken(_OWNER_ID, "owner")

        client.post("/api/holidays/create",
                    json={"date": "2026-10-02", "name": "Gandhi Jayanti"},
                    headers={"Authorization": f"Bearer {strToken}"})
        objResp = client.post("/api/holidays/create",
                               json={"date": "2026-10-02", "name": "Duplicate"},
                               headers={"Authorization": f"Bearer {strToken}"})
        assert objResp.status_code == 409

    def test_create_holiday_invalid_date(self, objClient):
        """POST /api/holidays/create — malformed date returns 400."""
        client, _ = objClient
        strToken = _makeToken(_OWNER_ID, "owner")
        objResp = client.post("/api/holidays/create",
                               json={"date": "15-08-2026", "name": "Wrong Format"},
                               headers={"Authorization": f"Bearer {strToken}"})
        assert objResp.status_code == 400

    def test_create_holiday_non_admin_forbidden(self, objClient):
        """POST /api/holidays/create — employee role should be forbidden."""
        client, _ = objClient
        strToken = _makeToken(_EMPLOYEE_ID, "employee")
        objResp = client.post("/api/holidays/create",
                               json={"date": "2026-12-25", "name": "Christmas"},
                               headers={"Authorization": f"Bearer {strToken}"})
        assert objResp.status_code in (403, 401)

    def test_delete_holiday(self, objClient):
        """DELETE /api/holidays/:id — removes the holiday."""
        client, objDb = objClient
        strToken = _makeToken(_OWNER_ID, "owner")

        # Create first
        objCreate = client.post("/api/holidays/create",
                                 json={"date": "2026-11-01", "name": "All Saints Day"},
                                 headers={"Authorization": f"Bearer {strToken}"})
        assert objCreate.status_code == 201
        strHolidayId = objCreate.json()["holiday_id"]

        # Delete
        objDel = client.delete(f"/api/holidays/{strHolidayId}",
                                headers={"Authorization": f"Bearer {strToken}"})
        assert objDel.status_code == 204

        # Confirm it's gone
        objList = client.get("/api/holidays/list",
                              headers={"Authorization": f"Bearer {strToken}"})
        lsIds = [h["holiday_id"] for h in objList.json()]
        assert strHolidayId not in lsIds

    def test_list_after_create(self, objClient):
        """GET /api/holidays/list — newly created holiday appears in list."""
        client, _ = objClient
        strAdminToken = _makeToken(_OWNER_ID, "owner")
        strUserToken = _makeToken(_EMPLOYEE_ID, "employee")

        client.post("/api/holidays/create",
                    json={"date": "2026-09-05", "name": "Teachers Day"},
                    headers={"Authorization": f"Bearer {strAdminToken}"})

        objResp = client.get("/api/holidays/list",
                             headers={"Authorization": f"Bearer {strUserToken}"})
        assert objResp.status_code == 200
        lsNames = [h["name"] for h in objResp.json()]
        assert "Teachers Day" in lsNames


# ─────────────────────────────────────────────────────────────────────────────
# Categories — CRUD with department_ids (Settings Categories people-picker)
# ─────────────────────────────────────────────────────────────────────────────

class TestCategories:

    def test_create_category_by_role(self, objClient):
        """POST /api/categories/create — with allowed_roles (By Role picker)."""
        client, _ = objClient
        strToken = _makeToken(_OWNER_ID, "owner")

        objResp = client.post(
            "/api/categories/create",
            json={
                "name": "Accommodation",
                "max_limit": 8000,
                "allowed_roles": ["manager", "senior_manager"],
                "department_ids": [],
                "sub_categories": ["Hotel", "Guest House"],
                "requires_invoice": True,
                "approval_required": True,
            },
            headers={"Authorization": f"Bearer {strToken}"},
        )
        assert objResp.status_code == 201, objResp.text
        dictBody = objResp.json()
        assert dictBody["name"] == "Accommodation"
        assert set(dictBody["allowed_roles"]) >= {"manager", "senior_manager"}
        assert dictBody["department_ids"] == []

    def test_create_category_by_department(self, objClient):
        """POST /api/categories/create — with department_ids (By Department picker)."""
        client, _ = objClient
        strToken = _makeToken(_OWNER_ID, "owner")

        objResp = client.post(
            "/api/categories/create",
            json={
                "name": "Engineering Tools",
                "max_limit": 20000,
                "allowed_roles": [],
                "department_ids": [_DEPT_ID],
                "sub_categories": [],
                "requires_invoice": True,
                "approval_required": False,
            },
            headers={"Authorization": f"Bearer {strToken}"},
        )
        assert objResp.status_code == 201, objResp.text
        dictBody = objResp.json()
        assert _DEPT_ID in dictBody["department_ids"]

    def test_create_duplicate_category_name(self, objClient):
        """POST /api/categories/create — duplicate active name returns 400."""
        client, _ = objClient
        strToken = _makeToken(_OWNER_ID, "owner")

        # "Travel" is already seeded
        objResp = client.post(
            "/api/categories/create",
            json={
                "name": "Travel",
                "max_limit": 3000,
                "allowed_roles": ["employee"],
                "department_ids": [],
                "sub_categories": [],
                "requires_invoice": True,
                "approval_required": True,
            },
            headers={"Authorization": f"Bearer {strToken}"},
        )
        assert objResp.status_code == 400

    def test_list_categories(self, objClient):
        """GET /api/categories/list — returns active categories including seeded one."""
        client, _ = objClient
        strToken = _makeToken(_EMPLOYEE_ID, "employee")

        objResp = client.get("/api/categories/list",
                             headers={"Authorization": f"Bearer {strToken}"})
        assert objResp.status_code == 200, objResp.text
        lsCats = objResp.json()
        assert any(c["name"] == "Travel" for c in lsCats)

    def test_update_category_department_ids(self, objClient):
        """PUT /api/categories/:id — update department_ids (By Department mode)."""
        client, _ = objClient
        strToken = _makeToken(_OWNER_ID, "owner")

        objResp = client.put(
            f"/api/categories/{_CAT_ID}",
            json={"department_ids": [_DEPT_ID], "allowed_roles": []},
            headers={"Authorization": f"Bearer {strToken}"},
        )
        assert objResp.status_code == 200, objResp.text
        assert _DEPT_ID in objResp.json()["department_ids"]

    def test_create_category_non_owner_forbidden(self, objClient):
        """POST /api/categories/create — non-owner role is forbidden."""
        client, _ = objClient
        strToken = _makeToken(_EMPLOYEE_ID, "employee")

        objResp = client.post(
            "/api/categories/create",
            json={
                "name": "Unauthorized",
                "max_limit": 100,
                "allowed_roles": [],
                "department_ids": [],
                "sub_categories": [],
                "requires_invoice": False,
                "approval_required": False,
            },
            headers={"Authorization": f"Bearer {strToken}"},
        )
        assert objResp.status_code in (403, 401)


# ─────────────────────────────────────────────────────────────────────────────
# Notifications — list and mark-read (Notifications inbox)
# ─────────────────────────────────────────────────────────────────────────────

class TestNotifications:

    def _seedNotification(self, objDb, strUserId: str, strType: str, strReimbId: str | None = None) -> str:
        dictDoc = {
            "_id": ObjectId(),
            "user_id": strUserId,
            "type": strType,
            "title": f"{strType} notification",
            "message": f"Test message for {strType}",
            "reimbursement_id": strReimbId,
            "is_read": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        objDb["notifications"].insert_one(dictDoc)
        return str(dictDoc["_id"])

    def test_list_empty(self, objClient):
        """GET /api/notifications/list — no notifications → empty list, unread_count=0."""
        client, objDb = objClient
        # Create a fresh user with no notifications
        strNewUserId = str(ObjectId())
        objDb["users"].insert_one({
            "_id": ObjectId(strNewUserId),
            "name": "Fresh User",
            "email": "fresh@example.com",
            "departments": [{"department_id": _DEPT_ID, "role": "employee", "is_primary": True}],
            "managers": [],
            "is_active": True,
        })
        strToken = _makeToken(strNewUserId, "employee")
        objResp = client.get("/api/notifications/list",
                             headers={"Authorization": f"Bearer {strToken}"})
        assert objResp.status_code == 200
        dictBody = objResp.json()
        assert dictBody["unread_count"] == 0
        assert dictBody["notifications"] == []

    def test_list_returns_seeded_notifications(self, objClient):
        """GET /api/notifications/list — returns notifications for the current user."""
        client, objDb = objClient
        strToken = _makeToken(_EMPLOYEE_ID, "employee")

        self._seedNotification(objDb, _EMPLOYEE_ID, "APPROVAL_PENDING", "reimb_001")
        self._seedNotification(objDb, _EMPLOYEE_ID, "REJECTED", "reimb_002")

        objResp = client.get("/api/notifications/list",
                             headers={"Authorization": f"Bearer {strToken}"})
        assert objResp.status_code == 200
        dictBody = objResp.json()
        assert dictBody["unread_count"] >= 2
        assert len(dictBody["notifications"]) >= 2

        lsTypes = [n["type"] for n in dictBody["notifications"]]
        assert "APPROVAL_PENDING" in lsTypes
        assert "REJECTED" in lsTypes

    def test_list_unread_only_filter(self, objClient):
        """GET /api/notifications/list?unread_only=true — filters to unread."""
        client, objDb = objClient
        strToken = _makeToken(_MANAGER_ID, "manager")

        # Insert one unread and one read
        strUnreadId = self._seedNotification(objDb, _MANAGER_ID, "APPROVAL_PENDING")
        # Manually mark the second as read
        strReadId = self._seedNotification(objDb, _MANAGER_ID, "PAID")
        objDb["notifications"].update_one({"_id": ObjectId(strReadId)}, {"$set": {"is_read": True}})

        objResp = client.get("/api/notifications/list?unread_only=true",
                             headers={"Authorization": f"Bearer {strToken}"})
        assert objResp.status_code == 200
        lsNotifs = objResp.json()["notifications"]
        assert all(not n["is_read"] for n in lsNotifs)

    def test_notification_contains_reimbursement_id(self, objClient):
        """Notifications include reimbursement_id for View Details navigation."""
        client, objDb = objClient
        strToken = _makeToken(_OWNER_ID, "owner")
        strFakeReimbId = "reimb_nav_test_001"

        self._seedNotification(objDb, _OWNER_ID, "QUERY_RAISED", strFakeReimbId)

        objResp = client.get("/api/notifications/list",
                             headers={"Authorization": f"Bearer {strToken}"})
        assert objResp.status_code == 200
        lsNotifs = objResp.json()["notifications"]
        lsWithReimb = [n for n in lsNotifs if n.get("reimbursement_id") == strFakeReimbId]
        assert len(lsWithReimb) == 1
        assert lsWithReimb[0]["type"] == "QUERY_RAISED"

    def test_mark_read_specific_ids(self, objClient):
        """POST /api/notifications/mark-read — specific IDs are marked read."""
        client, objDb = objClient
        strToken = _makeToken(_EMPLOYEE_ID, "employee")

        strId1 = self._seedNotification(objDb, _EMPLOYEE_ID, "CA_QUERY")
        strId2 = self._seedNotification(objDb, _EMPLOYEE_ID, "REAPPLIED")

        objResp = client.post(
            "/api/notifications/mark-read",
            json={"notification_ids": [strId1], "mark_all": False},
            headers={"Authorization": f"Bearer {strToken}"},
        )
        assert objResp.status_code == 200
        assert objResp.json()["updated"] >= 1

        # Confirm only strId1 is now read
        dictNotif1 = objDb["notifications"].find_one({"_id": ObjectId(strId1)})
        dictNotif2 = objDb["notifications"].find_one({"_id": ObjectId(strId2)})
        assert dictNotif1["is_read"] is True
        assert dictNotif2["is_read"] is False

    def test_mark_all_read(self, objClient):
        """POST /api/notifications/mark-read?mark_all=true — marks all as read."""
        client, objDb = objClient
        strToken = _makeToken(_MANAGER_ID, "manager")

        self._seedNotification(objDb, _MANAGER_ID, "PRIVATE_ASK")
        self._seedNotification(objDb, _MANAGER_ID, "CA_REAPPLIED")

        objResp = client.post(
            "/api/notifications/mark-read",
            json={"notification_ids": [], "mark_all": True},
            headers={"Authorization": f"Bearer {strToken}"},
        )
        assert objResp.status_code == 200

        # All notifications for this user should now be read
        iUnread = objDb["notifications"].count_documents(
            {"user_id": _MANAGER_ID, "is_read": False}
        )
        assert iUnread == 0

    def test_unread_count_endpoint(self, objClient):
        """GET /api/notifications/unread-count — returns accurate integer."""
        client, objDb = objClient
        strNewUserId = str(ObjectId())
        objDb["users"].insert_one({
            "_id": ObjectId(strNewUserId),
            "name": "Count User",
            "email": "countuser@example.com",
            "departments": [{"department_id": _DEPT_ID, "role": "employee", "is_primary": True}],
            "managers": [],
            "is_active": True,
        })
        strToken = _makeToken(strNewUserId, "employee")

        self._seedNotification(objDb, strNewUserId, "ACKNOWLEDGED")
        self._seedNotification(objDb, strNewUserId, "PAID")

        objResp = client.get("/api/notifications/unread-count",
                             headers={"Authorization": f"Bearer {strToken}"})
        assert objResp.status_code == 200
        assert objResp.json()["unread_count"] == 2
