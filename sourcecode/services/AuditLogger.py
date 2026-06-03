'''
Purpose : Centralised audit trail logger.
          Every mutation to a critical collection (reimbursements, users,
          categories, departments) MUST call logMutation() to record a
          before/after snapshot for traceability.

Inputs  : Collection name, before/after document dicts, action label, actor ID.

Output  : Inserts a document into the `audit_events` collection.

Dependencies: config.mongodb_config, utils.date_utils
'''

import logging
import sys
import os
from typing import Optional, Any
from bson import ObjectId

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config.mongodb_config import get_collection
from utils.date_utils import getCurrentIst

objLogger = logging.getLogger(__name__)


def logMutation(
    strCollection: str,
    dictBefore: Optional[dict],
    dictAfter: Optional[dict],
    strAction: str,
    strActorId: str,
    strReferenceId: Optional[str] = None,
    strNote: Optional[str] = None,
) -> str:
    """
    Purpose : Insert an immutable audit record capturing a before/after snapshot
              of a document mutation.

    Inputs  :   (1) strCollection  : Name of the MongoDB collection mutated (str).
                (2) dictBefore     : Document state before the change (dict or None for INSERT).
                (3) dictAfter      : Document state after the change (dict or None for DELETE).
                (4) strAction      : Action label, e.g. "INSERT", "UPDATE", "DELETE",
                                     "APPROVE", "QUERY", "PAID" (str).
                (5) strActorId     : _id (as string) of the user who performed the action (str).
                (6) strReferenceId : Optional linked document ID, e.g. reimbursement _id (str).
                (7) strNote        : Optional human-readable note / reason (str).

    Output  : Inserted audit event _id as string.

    Example : logMutation(
                  "reimbursements",
                  dictOldReimb,
                  dictNewReimb,
                  "APPROVE",
                  strManagerId,
                  strReferenceId=strReimbId,
              )
    """
    try:
        # Strip any ObjectId values to strings so the audit record is serialisable
        dictAuditEvent = {
            "collection": strCollection,
            "action": strAction,
            "actor_id": strActorId,
            "before": _sanitiseForAudit(dictBefore),
            "after": _sanitiseForAudit(dictAfter),
            "created_at": getCurrentIst(),
        }
        if strReferenceId:
            dictAuditEvent["reference_id"] = strReferenceId
        if strNote:
            dictAuditEvent["note"] = strNote

        objAudit = get_collection("audit_events")
        objResult = objAudit.insert_one(dictAuditEvent)
        strInsertedId = str(objResult.inserted_id)

        objLogger.info(
            f"✅ Audit logged | collection={strCollection} | action={strAction} "
            f"| actor={strActorId} | audit_id={strInsertedId}"
        )
        return strInsertedId

    except Exception as objErr:
        # Audit failures should NEVER crash the business flow — log and continue.
        objLogger.error(f"❌ AuditLogger failed: {objErr}")
        return ""


def _sanitiseForAudit(dictDoc: Optional[Any]) -> Optional[Any]:
    """
    Purpose : Recursively convert ObjectId / datetime values to strings for
              safe BSON storage in the audit document.

    Inputs  :   (1) dictDoc : dict, list, or scalar to sanitise.

    Output  : JSON-safe equivalent.

    Example : _sanitiseForAudit({"_id": ObjectId("...")})
              # {"_id": "..."}
    """
    if dictDoc is None:
        return None
    if isinstance(dictDoc, dict):
        return {k: _sanitiseForAudit(v) for k, v in dictDoc.items()}
    if isinstance(dictDoc, list):
        return [_sanitiseForAudit(item) for item in dictDoc]
    if isinstance(dictDoc, ObjectId):
        return str(dictDoc)
    return dictDoc
