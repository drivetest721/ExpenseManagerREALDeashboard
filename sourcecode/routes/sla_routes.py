'''
Purpose : SLA management endpoints for Admin/Owner.
          View current SLA events, manually trigger the SLA check job.

Inputs  : HTTP requests (query params for filtering).

Output  : JSON responses with SLA event lists and job summary.

Dependencies: fastapi, config.mongodb_config, middleware.jwt_middleware,
              controllers.SLAEngine
'''

import logging
from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Query
from bson import ObjectId

from config.mongodb_config import get_collection
from middleware.jwt_middleware import getAdminUserDependency
from controllers.SLAEngine import runSLACheck

objLogger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/sla", tags=["SLA"])


def _serializeEvent(doc: dict) -> dict:
    """Convert a raw sla_events doc to a JSON-safe dict."""
    return {
        "event_id":            str(doc["_id"]),
        "reimbursement_id":    doc.get("reimbursement_id", ""),
        "event_type":          doc.get("event_type", ""),
        "reviewer_id":         doc.get("reviewer_id"),
        "due_at":              doc.get("due_at", ""),
        "is_resolved":         doc.get("is_resolved", False),
        "reminder_sent":       doc.get("reminder_sent", False),
        "resolve_reason":      doc.get("resolve_reason"),
        "created_at":          doc.get("created_at", ""),
    }


@router.get("/events", summary="List SLA events (Admin/Owner only)")
async def listSLAEvents(
    bResolved: Optional[bool] = Query(None, alias="resolved", description="Filter by resolved status"),
    strEventType: Optional[str] = Query(None, alias="event_type", description="REVIEW_PENDING | QUERY_RESPONSE_PENDING"),
    iLimit: int = Query(50, alias="limit", ge=1, le=200),
    dictCurrentUser: dict = Depends(getAdminUserDependency),
):
    """
    Purpose : Return SLA events for monitoring.
              Admins/Owners only.

    Inputs  :   (1) resolved   : Optional bool filter
                (2) event_type : Optional type filter
                (3) limit      : Max records (default 50)

    Output  : JSON { success, total, items: [...] }

    Example : GET /api/sla/events?resolved=false
    """
    try:
        objSLA = get_collection("sla_events")
        objReimbs = get_collection("reimbursements")

        dictFilter: dict = {}
        if bResolved is not None:
            dictFilter["is_resolved"] = bResolved
        if strEventType:
            dictFilter["event_type"] = strEventType

        lsRaw = list(objSLA.find(dictFilter).sort("due_at", 1).limit(iLimit))
        lsItems = []

        for doc in lsRaw:
            dictItem = _serializeEvent(doc)
            # Enrich with reimbursement code + initiator name
            try:
                strRId = doc.get("reimbursement_id", "")
                if strRId:
                    dictR = objReimbs.find_one({"_id": ObjectId(strRId)}, {"reimbursement_code": 1, "initiator_name": 1, "status": 1})
                    if dictR:
                        dictItem["reimbursement_code"] = dictR.get("reimbursement_code", strRId[:8])
                        dictItem["initiator_name"]     = dictR.get("initiator_name", "—")
                        dictItem["reimbursement_status"] = dictR.get("status", "—")
            except Exception:
                pass
            lsItems.append(dictItem)

        return {"success": True, "total": len(lsItems), "items": lsItems}

    except Exception as objErr:
        objLogger.error(f"❌ LIST SLA EVENTS ERROR: {objErr}")
        return {"success": False, "message": str(objErr), "items": []}


@router.post("/run", summary="Manually trigger SLA check (Admin/Owner only)")
async def triggerSLACheck(
    dictCurrentUser: dict = Depends(getAdminUserDependency),
):
    """
    Purpose : Manually trigger the SLA check job (useful for testing / ops).
              Normally runs automatically every hour via APScheduler.

    Inputs  : None (admin auth required)

    Output  : JSON { success, reminders_sent, auto_rejected, errors }

    Example : POST /api/sla/run
    """
    try:
        objLogger.info(f"🔧 MANUAL SLA RUN requested by {dictCurrentUser.get('user_id')}")
        dictSummary = runSLACheck()
        return {"success": True, **dictSummary}
    except Exception as objErr:
        objLogger.error(f"❌ MANUAL SLA RUN ERROR: {objErr}")
        return {"success": False, "message": str(objErr)}


@router.get("/overdue-count", summary="Get count of overdue SLA events")
async def getOverdueCount(
    dictCurrentUser: dict = Depends(getAdminUserDependency),
):
    """
    Purpose : Quick badge count — how many open SLA events are currently overdue.

    Inputs  : None

    Output  : JSON { success, count }

    Example : GET /api/sla/overdue-count
    """
    try:
        objSLA = get_collection("sla_events")
        dtNowIso = datetime.now(timezone.utc).isoformat()
        iCount = objSLA.count_documents({"is_resolved": False, "due_at": {"$lte": dtNowIso}})
        return {"success": True, "count": iCount}
    except Exception as objErr:
        return {"success": False, "count": 0, "message": str(objErr)}
