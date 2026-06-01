'''
Purpose : Analytics endpoints aggregating spend & status across reimbursements.
          Restricted to Owner/CA (admin) users.

Inputs  : Authenticated HTTP GET requests with optional query params (months, limit).

Output  : JSON dicts/lists shaped for the AnalyticsPage charts.

Dependencies: fastapi, bson, mongodb_config, jwt_middleware, common_enums.
'''

import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from config.mongodb_config import get_collection
from middleware.jwt_middleware import getAdminUserDependency

objLogger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/analytics", tags=["Analytics"])


# ── helpers ───────────────────────────────────────────────────────────────────

_lsApprovedStatuses = ["OWNER_APPROVED", "CA_PENDING", "PAID", "PAYMENT_ACKNOWLEDGED", "CLOSED"]
_lsPendingStatuses = ["SUBMITTED", "IN_REVIEW", "QUERY_RAISED", "PRIVATE_ASK", "REAPPLIED", "CA_QUERY", "CA_REAPPLIED"]
_lsPaidStatuses = ["PAID", "PAYMENT_ACKNOWLEDGED", "CLOSED"]
_lsRejectedStatuses = ["REJECTED", "AUTO_REJECTED"]


def _itemsTotal(dictDoc: dict) -> float:
    """Sum the `amount` field across `items[]` of a reimbursement document."""
    numTotal = 0.0
    for objItem in dictDoc.get("items", []) or []:
        try:
            numTotal += float(objItem.get("amount", 0) or 0)
        except (TypeError, ValueError):
            continue
    return numTotal


def _parseCreatedAt(strVal) -> Optional[datetime]:
    """Parse a stored created_at string/datetime into a tz-aware datetime."""
    if not strVal:
        return None
    if isinstance(strVal, datetime):
        return strVal if strVal.tzinfo else strVal.replace(tzinfo=timezone.utc)
    try:
        dtParsed = datetime.fromisoformat(str(strVal).replace("Z", "+00:00"))
        return dtParsed if dtParsed.tzinfo else dtParsed.replace(tzinfo=timezone.utc)
    except (TypeError, ValueError):
        return None


def _loadAllReimbursements() -> list:
    """Fetch every reimbursement document (analytics scope)."""
    return list(get_collection("reimbursements").find({}))


# ── endpoints ─────────────────────────────────────────────────────────────────

@router.get("/summary")
async def getAnalyticsSummary(
    dictCurrentUser: dict = Depends(getAdminUserDependency),
):
    """
    Purpose : High-level KPI tiles for the dashboard.
    Output  : { totals: { count, draft, pending, approved, paid, rejected },
                amounts: { total, paid, pending, approved } }
    """
    try:
        lsDocs = _loadAllReimbursements()
        dictTotals = {"count": 0, "draft": 0, "pending": 0, "approved": 0, "paid": 0, "rejected": 0}
        dictAmounts = {"total": 0.0, "paid": 0.0, "pending": 0.0, "approved": 0.0}

        for dictDoc in lsDocs:
            strStatus = dictDoc.get("status", "")
            numAmount = _itemsTotal(dictDoc)
            dictTotals["count"] += 1
            dictAmounts["total"] += numAmount

            if strStatus == "DRAFT":
                dictTotals["draft"] += 1
            elif strStatus in _lsPendingStatuses:
                dictTotals["pending"] += 1
                dictAmounts["pending"] += numAmount
            elif strStatus in _lsPaidStatuses:
                dictTotals["paid"] += 1
                dictAmounts["paid"] += numAmount
                dictAmounts["approved"] += numAmount
            elif strStatus == "OWNER_APPROVED" or strStatus == "CA_PENDING":
                dictTotals["approved"] += 1
                dictAmounts["approved"] += numAmount
            elif strStatus in _lsRejectedStatuses:
                dictTotals["rejected"] += 1

        return {"totals": dictTotals, "amounts": dictAmounts}

    except Exception as objErr:
        objLogger.error(f"❌ ANALYTICS SUMMARY ERROR: {objErr}")
        raise HTTPException(status_code=500, detail=str(objErr))


@router.get("/by-status")
async def getAnalyticsByStatus(
    dictCurrentUser: dict = Depends(getAdminUserDependency),
):
    """
    Purpose : Counts and totals grouped by reimbursement status.
    Output  : [ { status, count, amount } ]
    """
    try:
        lsDocs = _loadAllReimbursements()
        dictMap: dict = {}
        for dictDoc in lsDocs:
            strStatus = dictDoc.get("status", "UNKNOWN")
            if strStatus not in dictMap:
                dictMap[strStatus] = {"status": strStatus, "count": 0, "amount": 0.0}
            dictMap[strStatus]["count"] += 1
            dictMap[strStatus]["amount"] += _itemsTotal(dictDoc)
        return sorted(dictMap.values(), key=lambda d: d["count"], reverse=True)

    except Exception as objErr:
        objLogger.error(f"❌ ANALYTICS BY-STATUS ERROR: {objErr}")
        raise HTTPException(status_code=500, detail=str(objErr))


@router.get("/by-category")
async def getAnalyticsByCategory(
    dictCurrentUser: dict = Depends(getAdminUserDependency),
):
    """
    Purpose : Aggregate spend per category (excluding drafts).
    Output  : [ { category_id, name, count, amount } ] sorted by amount desc.
    """
    try:
        lsDocs = _loadAllReimbursements()
        objCats = get_collection("reimbursement_categories")
        lsCats = list(objCats.find({}))
        dictCatNames = {str(c["_id"]): c.get("name", "Unknown") for c in lsCats}

        dictMap: dict = {}
        for dictDoc in lsDocs:
            if dictDoc.get("status") == "DRAFT":
                continue
            for objItem in dictDoc.get("items", []) or []:
                strCatId = str(objItem.get("category_id", "")) if objItem.get("category_id") else ""
                if not strCatId:
                    continue
                if strCatId not in dictMap:
                    dictMap[strCatId] = {
                        "category_id": strCatId,
                        "name": dictCatNames.get(strCatId, "Unknown"),
                        "count": 0,
                        "amount": 0.0,
                    }
                dictMap[strCatId]["count"] += 1
                try:
                    dictMap[strCatId]["amount"] += float(objItem.get("amount", 0) or 0)
                except (TypeError, ValueError):
                    continue
        return sorted(dictMap.values(), key=lambda d: d["amount"], reverse=True)

    except Exception as objErr:
        objLogger.error(f"❌ ANALYTICS BY-CATEGORY ERROR: {objErr}")
        raise HTTPException(status_code=500, detail=str(objErr))


@router.get("/by-department")
async def getAnalyticsByDepartment(
    dictCurrentUser: dict = Depends(getAdminUserDependency),
):
    """
    Purpose : Aggregate spend per department (using initiator's primary department).
    Output  : [ { department_id, name, count, amount } ] sorted by amount desc.
    """
    try:
        lsDocs = _loadAllReimbursements()
        objUsers = get_collection("users")
        objDepts = get_collection("departments")

        lsUsers = list(objUsers.find({}))
        dictUserPrimaryDept: dict = {}
        for dictUser in lsUsers:
            strUid = str(dictUser["_id"])
            lsDepts = dictUser.get("departments", []) or []
            strDeptId = ""
            for d in lsDepts:
                if d.get("is_primary"):
                    strDeptId = str(d.get("department_id", ""))
                    break
            if not strDeptId and lsDepts:
                strDeptId = str(lsDepts[0].get("department_id", ""))
            dictUserPrimaryDept[strUid] = strDeptId

        lsDeptDocs = list(objDepts.find({}))
        dictDeptNames = {str(d["_id"]): d.get("department_name", "Unknown") for d in lsDeptDocs}

        dictMap: dict = {}
        for dictDoc in lsDocs:
            if dictDoc.get("status") == "DRAFT":
                continue
            strInitiator = str(dictDoc.get("initiator_id", ""))
            strDeptId = dictUserPrimaryDept.get(strInitiator, "")
            strKey = strDeptId or "unassigned"
            if strKey not in dictMap:
                dictMap[strKey] = {
                    "department_id": strDeptId,
                    "name": dictDeptNames.get(strDeptId, "Unassigned"),
                    "count": 0,
                    "amount": 0.0,
                }
            dictMap[strKey]["count"] += 1
            dictMap[strKey]["amount"] += _itemsTotal(dictDoc)

        return sorted(dictMap.values(), key=lambda d: d["amount"], reverse=True)

    except Exception as objErr:
        objLogger.error(f"❌ ANALYTICS BY-DEPARTMENT ERROR: {objErr}")
        raise HTTPException(status_code=500, detail=str(objErr))



@router.get("/monthly-trend")
async def getAnalyticsMonthlyTrend(
    months: int = Query(6, ge=1, le=24),
    dictCurrentUser: dict = Depends(getAdminUserDependency),
):
    """
    Purpose : Time-series of submitted spend per month for the last N months.
    Output  : [ { month: 'YYYY-MM', label: 'Jan 2026', count, amount } ]
    """
    try:
        dtNow = datetime.now(timezone.utc)
        lsBuckets: list = []
        dictIdx: dict = {}
        iYear, iMonth = dtNow.year, dtNow.month
        for _ in range(months):
            strKey = f"{iYear:04d}-{iMonth:02d}"
            strLabel = datetime(iYear, iMonth, 1).strftime("%b %Y")
            dictBucket = {"month": strKey, "label": strLabel, "count": 0, "amount": 0.0}
            lsBuckets.append(dictBucket)
            dictIdx[strKey] = dictBucket
            iMonth -= 1
            if iMonth == 0:
                iMonth = 12
                iYear -= 1
        lsBuckets.reverse()

        for dictDoc in _loadAllReimbursements():
            if dictDoc.get("status") == "DRAFT":
                continue
            dtCreated = _parseCreatedAt(dictDoc.get("created_at"))
            if not dtCreated:
                continue
            strKey = f"{dtCreated.year:04d}-{dtCreated.month:02d}"
            if strKey not in dictIdx:
                continue
            dictIdx[strKey]["count"] += 1
            dictIdx[strKey]["amount"] += _itemsTotal(dictDoc)

        return lsBuckets

    except Exception as objErr:
        objLogger.error(f"❌ ANALYTICS MONTHLY-TREND ERROR: {objErr}")
        raise HTTPException(status_code=500, detail=str(objErr))


@router.get("/top-spenders")
async def getAnalyticsTopSpenders(
    limit: int = Query(5, ge=1, le=50),
    dictCurrentUser: dict = Depends(getAdminUserDependency),
):
    """
    Purpose : Top N initiators ranked by approved/paid spend.
    Output  : [ { user_id, name, count, amount } ] sorted desc, capped at `limit`.
    """
    try:
        lsDocs = _loadAllReimbursements()
        dictMap: dict = {}
        for dictDoc in lsDocs:
            strStatus = dictDoc.get("status", "")
            if strStatus not in _lsApprovedStatuses:
                continue
            strUid = str(dictDoc.get("initiator_id", ""))
            if not strUid:
                continue
            if strUid not in dictMap:
                dictMap[strUid] = {
                    "user_id": strUid,
                    "name": dictDoc.get("initiator_name", "Unknown"),
                    "count": 0,
                    "amount": 0.0,
                }
            dictMap[strUid]["count"] += 1
            dictMap[strUid]["amount"] += _itemsTotal(dictDoc)

        lsRanked = sorted(dictMap.values(), key=lambda d: d["amount"], reverse=True)
        return lsRanked[:limit]

    except Exception as objErr:
        objLogger.error(f"❌ ANALYTICS TOP-SPENDERS ERROR: {objErr}")
        raise HTTPException(status_code=500, detail=str(objErr))
