'''
Purpose : Centralised MongoDB connection management. Exposes get_collection() helper
          that every route/controller MUST use; never instantiate MongoClient elsewhere.

Inputs  : Reads MONGODB_URL / MONGODB_DATABASE from env_config.

Output  : Singleton MongoClient + per-collection accessor + index bootstrap.

Dependencies: pymongo, env_config
'''

import sys
import os
import logging
from typing import Optional
from pymongo import MongoClient, ASCENDING, DESCENDING
from pymongo.collection import Collection
from pymongo.database import Database
from pymongo.errors import ConnectionFailure

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from env_config import objSettings

objLogger = logging.getLogger(__name__)

_objMongoClient: Optional[MongoClient] = None
_objDatabase: Optional[Database] = None


def get_mongo_client() -> MongoClient:
    """
    Purpose : Return lazily-instantiated singleton MongoClient.

    Inputs  : None

    Output  : pymongo.MongoClient instance.

    Example : objClient = get_mongo_client()
    """
    global _objMongoClient
    if _objMongoClient is None:
        objLogger.info(f"🔌 Connecting to MongoDB at {objSettings.MONGODB_URL}")
        _objMongoClient = MongoClient(
            objSettings.MONGODB_URL,
            serverSelectionTimeoutMS=5000,
            uuidRepresentation="standard",
        )
    return _objMongoClient


def get_database() -> Database:
    """
    Purpose : Return the active MongoDB database handle.

    Inputs  : None

    Output  : pymongo.database.Database instance.

    Example : objDb = get_database()
    """
    global _objDatabase
    if _objDatabase is None:
        _objDatabase = get_mongo_client()[objSettings.MONGODB_DATABASE]
    return _objDatabase


def get_collection(strCollectionName: str) -> Collection:
    """
    Purpose : Return a MongoDB collection by name (preferred accessor for all routes).

    Inputs  :   (1) strCollectionName : Collection name (str)

    Output  : pymongo.collection.Collection instance.

    Example : objUsers = get_collection("users")
              dictUser = objUsers.find_one({"email": "x@y.com"})
    """
    return get_database()[strCollectionName]


def ping_mongo() -> bool:
    """
    Purpose : Run an admin `ping` command to confirm MongoDB connectivity.

    Inputs  : None

    Output  : True if reachable, raises ConnectionFailure otherwise.

    Example : ping_mongo()
    """
    try:
        get_mongo_client().admin.command("ping")
        objLogger.info("✅ MongoDB reachable")
        return True
    except ConnectionFailure as objErr:
        objLogger.error(f"❌ MongoDB unreachable: {objErr}")
        raise


def ensure_indexes() -> None:
    """
    Purpose : Create required indexes for every collection used by the app.
              Safe to call on every startup (idempotent).

    Inputs  : None

    Output  : None

    Example : ensure_indexes()
    """
    objLogger.info("🛠  Ensuring MongoDB indexes…")

    objReimbursements = get_collection("reimbursements")
    objReimbursements.create_index([("initiator_id", ASCENDING)])
    objReimbursements.create_index([("current_reviewer_id", ASCENDING)])
    objReimbursements.create_index([("status", ASCENDING)])
    objReimbursements.create_index([("created_at", DESCENDING)])
    objReimbursements.create_index([("reimbursement_code", ASCENDING)], unique=True)

    objReimbItems = get_collection("reimbursement_items")
    objReimbItems.create_index([("reimbursement_id", ASCENDING)])

    objReimbLogs = get_collection("reimbursement_logs")
    objReimbLogs.create_index([("reimbursement_id", ASCENDING), ("created_at", DESCENDING)])

    objUsers = get_collection("users")
    objUsers.create_index([("email", ASCENDING)], unique=True)
    objUsers.create_index([("employee_id", ASCENDING)], unique=True, sparse=True)

    objNotifications = get_collection("notifications")
    objNotifications.create_index([("user_id", ASCENDING), ("is_read", ASCENDING)])
    objNotifications.create_index([("created_at", DESCENDING)])

    objAudit = get_collection("audit_events")
    objAudit.create_index([("collection", ASCENDING), ("created_at", DESCENDING)])

    objCounters = get_collection("counters")
    objCounters.create_index([("name", ASCENDING)], unique=True)

    objHolidays = get_collection("holidays")
    objHolidays.create_index([("date", ASCENDING)], unique=True)

    objLogger.info("✅ MongoDB indexes ensured")
