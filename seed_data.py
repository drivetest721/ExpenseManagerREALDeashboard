"""
Seed Script -- Expense Manager Test Data
=========================================
Creates a full company hierarchy so you can walk through the entire
reimbursement -> approval -> payment cycle in the UI.

Company : TechCorp India
Password: Test@1234  (same for every seeded user)

Run from the workspace root:
    .venv\\Scripts\\python.exe seed_data.py
    .venv\\Scripts\\python.exe seed_data.py --reset   (wipe old seed first)
"""

import sys
import os
import argparse
from datetime import datetime, timezone

import bcrypt
from bson import ObjectId
from pymongo import MongoClient

# ── Path bootstrap ─────────────────────────────────────────────────────────────
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "sourcecode"))
from env_config import objSettings  # noqa: E402

# ── Constants ──────────────────────────────────────────────────────────────────
_PASSWORD       = "Test@1234"
_RESET_TAG      = "seed_v1"            # marker stored on every seeded doc


def _hash(password: str) -> str:
    b = password.encode("utf-8")[:72]
    return bcrypt.hashpw(b, bcrypt.gensalt(rounds=12)).decode("utf-8")


def _now():
    return datetime.now(timezone.utc)


def _id() -> ObjectId:
    return ObjectId()


# ── MongoDB connection ─────────────────────────────────────────────────────────
def get_db():
    client = MongoClient(objSettings.MONGODB_URL, serverSelectionTimeoutMS=5000)
    return client[objSettings.MONGODB_DATABASE]


# ── Reset helpers ──────────────────────────────────────────────────────────────
def reset_seed(db):
    print("🗑  Removing previously seeded data …")
    for col in ("users", "departments", "reimbursement_categories", "payment_methods", "notifications"):
        result = db[col].delete_many({"_seed": _RESET_TAG})
        print(f"   {col}: removed {result.deleted_count} docs")


# ── Main seed ─────────────────────────────────────────────────────────────────
def seed(db):
    print("\n🌱 Seeding test data …\n")

    # ── 1. Departments ─────────────────────────────────────────────────────────
    eng_id   = _id()
    fin_id   = _id()

    # We'll set owner_ids after users are created
    dept_eng = {"_id": eng_id,  "department_name": "Engineering", "owner_ids": [], "is_active": True, "created_at": _now(), "_seed": _RESET_TAG}
    dept_fin = {"_id": fin_id,  "department_name": "Finance",     "owner_ids": [], "is_active": True, "created_at": _now(), "_seed": _RESET_TAG}

    # ── 2. Pre-allocate user IDs ────────────────────────────────────────────────
    owner_id   = _id()
    ca_id      = _id()
    smgr_id    = _id()
    mgr_id     = _id()
    emp1_id    = _id()
    emp2_id    = _id()
    intern_id  = _id()

    ph = _hash(_PASSWORD)

    # ── 3. Build user docs ──────────────────────────────────────────────────────
    def dept_entry(did, dname, role, primary=True):
        return {"department_id": str(did), "department_name": dname, "role": role, "is_primary": primary}

    def mgr_entry(mid, mname, priority, atype="mandatory"):
        return {"manager_id": str(mid), "manager_name": mname, "priority": priority, "approval_type": atype}

    users = [
        {
            "_id": owner_id,
            "employee_id": "EMP001", "name": "Rajesh Kumar (Owner)",
            "email": "owner@techcorp.com", "password_hash": ph,
            "departments": [dept_entry(eng_id, "Engineering", "owner")],
            "managers": [],
            "is_active": True, "has_payment_method": False, "created_at": _now(), "_seed": _RESET_TAG,
        },
        {
            "_id": ca_id,
            "employee_id": "EMP002", "name": "Priya Sharma (CA)",
            "email": "ca@techcorp.com", "password_hash": ph,
            "departments": [dept_entry(fin_id, "Finance", "ca")],
            "managers": [],
            "is_active": True, "has_payment_method": False, "created_at": _now(), "_seed": _RESET_TAG,
        },
        {
            "_id": smgr_id,
            "employee_id": "EMP003", "name": "Vikram Singh (Sr. Manager)",
            "email": "smanager@techcorp.com", "password_hash": ph,
            "departments": [dept_entry(eng_id, "Engineering", "senior_manager")],
            "managers": [mgr_entry(owner_id, "Rajesh Kumar (Owner)", 1)],
            "is_active": True, "has_payment_method": False, "created_at": _now(), "_seed": _RESET_TAG,
        },
        {
            "_id": mgr_id,
            "employee_id": "EMP004", "name": "Anita Patel (Manager)",
            "email": "manager@techcorp.com", "password_hash": ph,
            "departments": [dept_entry(eng_id, "Engineering", "manager")],
            "managers": [
                mgr_entry(smgr_id, "Vikram Singh (Sr. Manager)", 1),
                mgr_entry(owner_id, "Rajesh Kumar (Owner)",      2),
            ],
            "is_active": True, "has_payment_method": False, "created_at": _now(), "_seed": _RESET_TAG,
        },
        {
            "_id": emp1_id,
            "employee_id": "EMP005", "name": "Rohit Gupta (Employee)",
            "email": "employee@techcorp.com", "password_hash": ph,
            "departments": [dept_entry(eng_id, "Engineering", "employee")],
            "managers": [
                mgr_entry(mgr_id,   "Anita Patel (Manager)",       1),
                mgr_entry(smgr_id,  "Vikram Singh (Sr. Manager)",  2),
            ],
            "is_active": True, "has_payment_method": True, "created_at": _now(), "_seed": _RESET_TAG,
        },
        {
            "_id": emp2_id,
            "employee_id": "EMP006", "name": "Sneha Desai (Employee 2)",
            "email": "employee2@techcorp.com", "password_hash": ph,
            "departments": [dept_entry(eng_id, "Engineering", "employee")],
            "managers": [mgr_entry(mgr_id, "Anita Patel (Manager)", 1)],
            "is_active": True, "has_payment_method": True, "created_at": _now(), "_seed": _RESET_TAG,
        },
        {
            "_id": intern_id,
            "employee_id": "EMP007", "name": "Arjun Mehta (Intern)",
            "email": "intern@techcorp.com", "password_hash": ph,
            "departments": [dept_entry(eng_id, "Engineering", "intern")],
            "managers": [mgr_entry(mgr_id, "Anita Patel (Manager)", 1)],
            "is_active": True, "has_payment_method": False, "created_at": _now(), "_seed": _RESET_TAG,
        },
    ]

    # ── 4. Patch department owner_ids ───────────────────────────────────────────
    dept_eng["owner_ids"] = [str(owner_id)]
    dept_fin["owner_ids"] = [str(owner_id)]

    # ── 5. Payment methods for employees ───────────────────────────────────────
    payment_methods = [
        {"_id": _id(), "user_id": str(emp1_id), "type": "UPI_ID", "upi_id": "rohit.gupta@oksbi",  "qr_image_id": None, "is_default": True, "created_at": _now(), "_seed": _RESET_TAG},
        {"_id": _id(), "user_id": str(emp2_id), "type": "UPI_ID", "upi_id": "sneha.desai@okaxis",  "qr_image_id": None, "is_default": True, "created_at": _now(), "_seed": _RESET_TAG},
    ]

    # ── 6. Categories ───────────────────────────────────────────────────────────
    categories = [
        {"_id": _id(), "name": "Travel & Conveyance", "sub_categories": ["Flight", "Train", "Cab", "Bus"],
         "max_limit": 25000.0, "allowed_roles": ["owner","senior_manager","manager","employee","intern","ca"],
         "department_ids": [], "requires_invoice": True, "approval_required": True, "is_active": True, "created_at": _now(), "_seed": _RESET_TAG},
        {"_id": _id(), "name": "Food & Meals", "sub_categories": ["Lunch", "Dinner", "Team Lunch"],
         "max_limit": 5000.0, "allowed_roles": ["owner","senior_manager","manager","employee","ca"],
         "department_ids": [], "requires_invoice": False, "approval_required": True, "is_active": True, "created_at": _now(), "_seed": _RESET_TAG},
        {"_id": _id(), "name": "Office Supplies", "sub_categories": ["Stationery", "Peripherals", "Furniture"],
         "max_limit": 10000.0, "allowed_roles": ["owner","senior_manager","manager","employee","ca"],
         "department_ids": [], "requires_invoice": True, "approval_required": True, "is_active": True, "created_at": _now(), "_seed": _RESET_TAG},
        {"_id": _id(), "name": "Training & Courses", "sub_categories": ["Online Course", "Workshop", "Conference"],
         "max_limit": 15000.0, "allowed_roles": ["owner","senior_manager","manager","employee","intern","ca"],
         "department_ids": [], "requires_invoice": True, "approval_required": True, "is_active": True, "created_at": _now(), "_seed": _RESET_TAG},
        {"_id": _id(), "name": "Client Entertainment", "sub_categories": ["Dinner", "Gifts", "Events"],
         "max_limit": 20000.0, "allowed_roles": ["owner","senior_manager","manager"],
         "department_ids": [], "requires_invoice": True, "approval_required": True, "is_active": True, "created_at": _now(), "_seed": _RESET_TAG},
    ]

    # ── 7. Insert into MongoDB ──────────────────────────────────────────────────
    # Fix pre-existing wrong index (name_1 → department_name_1) before inserting
    try:
        db["departments"].drop_index("name_1")
    except Exception:
        pass
    db["departments"].insert_many([dept_eng, dept_fin])
    print(f"✅ Departments    : Engineering, Finance")

    db["users"].insert_many(users)
    print(f"✅ Users created  : {len(users)}")

    db["payment_methods"].insert_many(payment_methods)
    print(f"✅ Payment methods: {len(payment_methods)}")

    db["reimbursement_categories"].insert_many(categories)
    print(f"✅ Categories     : {len(categories)}")

    # ── 8. Summary ──────────────────────────────────────────────────────────────
    print("\n" + "="*60)
    print("  TEST CREDENTIALS  (password for all: Test@1234)")
    print("="*60)
    rows = [
        ("Owner",       "owner@techcorp.com",     "Full control, final approver"),
        ("CA",          "ca@techcorp.com",         "Handles payments after Owner approval"),
        ("Sr. Manager", "smanager@techcorp.com",   "Second in approval chain"),
        ("Manager",     "manager@techcorp.com",    "First in approval chain"),
        ("Employee",    "employee@techcorp.com",   "Can submit reimbursements (has UPI)"),
        ("Employee 2",  "employee2@techcorp.com",  "Can submit reimbursements (has UPI)"),
        ("Intern",      "intern@techcorp.com",     "No payment method yet"),
    ]
    for role, email, note in rows:
        print(f"  {role:<14} {email:<30} {note}")

    print("\n📋 APPROVAL CHAIN for Employee's request:")
    print("   Employee → Manager (Anita) → Sr. Manager (Vikram) → Owner (Rajesh) → CA (Priya) → Employee (acknowledge)")
    print("\n🏃 Start the backend:  cd sourcecode && uvicorn main:objApp --reload")
    print("🏃 Start the frontend: cd client && npm run dev")
    print("="*60 + "\n")


# ── Entry point ────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed test data for Expense Manager")
    parser.add_argument("--reset", action="store_true", help="Delete previously seeded data before inserting")
    args = parser.parse_args()

    db = get_db()

    if args.reset:
        reset_seed(db)

    try:
        seed(db)
    except Exception as e:
        print(f"\n❌ Seed failed: {e}")
        import traceback; traceback.print_exc()
        sys.exit(1)
