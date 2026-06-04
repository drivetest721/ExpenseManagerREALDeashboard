'''
Purpose : CRUD routes for Reimbursements — draft, submit, list, detail, delete.

Inputs  : HTTP requests (JSON bodies for mutations, query params for filters).

Output  : JSON success/error responses with Reimbursement metadata.

Dependencies: fastapi, mongodb_config, jwt_middleware, reimbursement_schemas, payment_method_routes, AuditLogger
'''

import logging
from datetime import datetime, timezone, date, time
from typing import List, Optional

from bson import ObjectId
from fastapi import APIRouter, HTTPException, status, Depends, Query

from config.mongodb_config import get_collection
from middleware.jwt_middleware import getCurrentUserDependency
from schemas.reimbursement_schemas import (
    ReimbursementCreateRequest,
    ReimbursementUpdateRequest,
    ReimbursementResponseSchema,
    ReimbursementListItemSchema,
    ReimbursementItemSummarySchema,
    ActivityLogSchema,
)
from routes.payment_method_routes import hasAnyPaymentMethod
from controllers.AuditLogger import logMutation
from controllers.ApprovalChainBuilder import buildChain, snapshotChain
from controllers.NotificationService import notifyAction
from controllers.SLAEngine import createSLAEvent
from controllers.ReimbursementCounter import getNextReimbursementCode
from controllers.ActivityLogService import logView, logEdit

objLogger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/reimbursements", tags=["Reimbursements"])


# ── helpers ───────────────────────────────────────────────────────────────────

def _docToResponse(dictDoc: dict) -> ReimbursementResponseSchema:
    """Map a MongoDB document to ReimbursementResponseSchema."""
    dictDoc = dict(dictDoc)
    dictDoc["reimbursement_id"] = str(dictDoc.pop("_id"))
    dictDoc["initiator_id"] = str(dictDoc.get("initiator_id", ""))

    # Resolve category names for all items in one batch query
    objCats = get_collection("reimbursement_categories")
    lsItems = dictDoc.get("items", []) or []
    setIds = set()
    for objItem in lsItems:
        if "category_id" in objItem and isinstance(objItem["category_id"], ObjectId):
            objItem["category_id"] = str(objItem["category_id"])
        strCatId = objItem.get("category_id")
        if strCatId:
            try:
                setIds.add(ObjectId(strCatId))
            except Exception:
                pass
    dictNameMap: dict = {}
    if setIds:
        for dictCat in objCats.find({"_id": {"$in": list(setIds)}}, {"name": 1}):
            dictNameMap[str(dictCat["_id"])] = dictCat.get("name", "")

    for objItem in lsItems:
        # Inject resolved name
        objItem["category_name"] = dictNameMap.get(str(objItem.get("category_id", "")))
        # Ensure description is always valid for response validation.
        strDesc = objItem.get("description")
        if not isinstance(strDesc, str):
            strDesc = str(strDesc) if strDesc is not None else ""
        if len(strDesc.strip()) < 3:
            objItem["description"] = "No description provided"
        else:
            objItem["description"] = strDesc
        # Convert datetime.date to string for JSON serialization
        if "expense_date" in objItem and hasattr(objItem["expense_date"], "isoformat"):
            objItem["expense_date"] = objItem["expense_date"].isoformat()

    # Serialize business_trip_meta dates
    if dictDoc.get("business_trip_meta"):
        objMeta = dictDoc["business_trip_meta"]
        if "from_date" in objMeta and hasattr(objMeta["from_date"], "isoformat"):
            objMeta["from_date"] = objMeta["from_date"].isoformat()
        if "to_date" in objMeta and hasattr(objMeta["to_date"], "isoformat"):
            objMeta["to_date"] = objMeta["to_date"].isoformat()

    # Normalize payment_proof for response (if present)
    if dictDoc.get("payment_proof"):
        try:
            objProof = dict(dictDoc.get("payment_proof") or {})
            # Ensure attachment_id is a string
            if objProof.get("attachment_id"):
                objProof["attachment_id"] = str(objProof.get("attachment_id"))
            # Ensure dates are strings
            if objProof.get("payment_date") and hasattr(objProof.get("payment_date"), "isoformat"):
                objProof["payment_date"] = objProof.get("payment_date").isoformat()
            dictDoc["payment_proof"] = objProof
        except Exception:
            # leave as-is on error
            pass

    return ReimbursementResponseSchema(**dictDoc)


def _validateBusinessTripDates(objRequest: ReimbursementCreateRequest) -> None:
    """Validate that all item dates fall within the business trip range."""
    if objRequest.form_type.value != "business_trip" or not objRequest.business_trip_meta:
        return

    objMeta = objRequest.business_trip_meta
    for objItem in objRequest.items:
        if not (objMeta.from_date <= objItem.expense_date <= objMeta.to_date):
            raise HTTPException(
                status_code=400,
                detail=f"Item expense_date {objItem.expense_date} is outside business trip range [{objMeta.from_date}, {objMeta.to_date}]"
            )


def _validateCategoryLimits(lsItems: list) -> None:
    """Reject any item whose amount exceeds the category's max_limit or skips a required invoice.
    Also enforce that each item has a non-empty description as required by UI.
    """
    if not lsItems:
        return
    objCats = get_collection("reimbursement_categories")
    dictCache: dict = {}
    for iIdx, objItem in enumerate(lsItems, start=1):
        # objItem may be a Pydantic model or a plain dict
        strCatId = objItem.category_id if hasattr(objItem, "category_id") else objItem.get("category_id")
        if not strCatId:
            continue
        if strCatId not in dictCache:
            try:
                dictCache[strCatId] = objCats.find_one({"_id": ObjectId(strCatId)})
            except Exception:
                dictCache[strCatId] = None
        dictCat = dictCache[strCatId]
        if not dictCat:
            raise HTTPException(status_code=400, detail=f"Item {iIdx}: Category not found.")
        if not dictCat.get("is_active", True):
            raise HTTPException(status_code=400, detail=f"Item {iIdx}: Category '{dictCat.get('name')}' is inactive.")
        numAmt = float(objItem.amount if hasattr(objItem, "amount") else objItem.get("amount", 0) or 0)
        numLimit = float(dictCat.get("max_limit", 0) or 0)
        if numLimit > 0 and numAmt > numLimit:
            raise HTTPException(
                status_code=400,
                detail=f"Item {iIdx}: Amount ₹{numAmt:,.0f} exceeds the ₹{numLimit:,.0f} limit for '{dictCat.get('name')}'."
            )

        # Description is now required per-row
        strDesc = objItem.description if hasattr(objItem, "description") else objItem.get("description", "")
        if not strDesc or strDesc.strip() == "":
            raise HTTPException(status_code=400, detail=f"Item {iIdx}: Description is required for each expense row.")

        # All reimbursements require an invoice/attachment (global rule).
        lsAtt = objItem.attachments if hasattr(objItem, "attachments") else objItem.get("attachments", []) or []
        if not lsAtt:
            raise HTTPException(
                status_code=400,
                detail=f"Item {iIdx}: An invoice attachment is required."
            )


def _coerceDate(objVal):
    """Convert datetime.date (not datetime) → datetime at midnight UTC for BSON encoding."""
    if isinstance(objVal, datetime):
        return objVal
    if isinstance(objVal, date):
        return datetime.combine(objVal, time.min, tzinfo=timezone.utc)
    return objVal


def _serializeDatesForMongo(dictDoc: dict) -> None:
    """In-place: convert any datetime.date inside items[*].expense_date and business_trip_meta.* to datetime."""
    for objItem in dictDoc.get("items", []) or []:
        if "expense_date" in objItem:
            objItem["expense_date"] = _coerceDate(objItem["expense_date"])
    objMeta = dictDoc.get("business_trip_meta")
    if objMeta:
        if "from_date" in objMeta:
            objMeta["from_date"] = _coerceDate(objMeta["from_date"])
        if "to_date" in objMeta:
            objMeta["to_date"] = _coerceDate(objMeta["to_date"])


def _logFieldChanges(strReimbursementId: str, strUserId: str, dictOld: dict, dictNew: dict) -> None:
    """
    Purpose : Compare old and new reimbursement documents and log field changes.

    Inputs  : (1) strReimbursementId - Reimbursement ID (str)
              (2) strUserId - User who made the changes (str)
              (3) dictOld - Old document state (dict)
              (4) dictNew - New document state (dict)

    Output  : None (logs edit entries)
    """
    # Fields to track for changes
    lsStrTrackedFields = ["description"]

    for strField in lsStrTrackedFields:
        strOldValue = str(dictOld.get(strField, "")) if dictOld.get(strField) else None
        strNewValue = str(dictNew.get(strField, "")) if dictNew.get(strField) else None

        if strOldValue != strNewValue:
            logEdit(
                strReimbursementId,
                strUserId,
                strField,
                strOldValue,
                strNewValue or "",
                "FIELD_CHANGED"
            )

    # Track item changes (additions, removals, modifications)
    lsOldItems = dictOld.get("items", [])
    lsNewItems = dictNew.get("items", [])

    if len(lsOldItems) != len(lsNewItems):
        logEdit(
            strReimbursementId,
            strUserId,
            "items_count",
            str(len(lsOldItems)),
            str(len(lsNewItems)),
            "FIELD_CHANGED"
        )


def _resolveCategoryNames(lsDocs: list) -> dict:
    """
    Batch-fetch category names for all category_ids found in lsDocs' items.
    Returns a dict {category_id_str: name}.
    """
    objCats = get_collection("reimbursement_categories")
    setIds = set()
    for dictDoc in lsDocs:
        for dictItem in dictDoc.get("items", []):
            strCatId = dictItem.get("category_id")
            if strCatId:
                try:
                    setIds.add(ObjectId(strCatId))
                except Exception:
                    pass
    dictNameMap = {}
    if setIds:
        for dictCat in objCats.find({"_id": {"$in": list(setIds)}}, {"name": 1}):
            dictNameMap[str(dictCat["_id"])] = dictCat.get("name", "")
    return dictNameMap


def _buildItemSummaries(dictDoc: dict, dictNameMap: dict) -> list:
    """Convert raw MongoDB items into ReimbursementItemSummarySchema list."""
    lsSummaries = []
    for dictItem in dictDoc.get("items", []):
        strCatId = str(dictItem.get("category_id", ""))
        objDate = dictItem.get("expense_date")
        strDate = objDate.isoformat() if hasattr(objDate, "isoformat") else (str(objDate) if objDate else None)
        lsSummaries.append(ReimbursementItemSummarySchema(
            category_id=strCatId,
            category_name=dictNameMap.get(strCatId),
            sub_category=dictItem.get("sub_category"),
            amount=float(dictItem.get("amount", 0) or 0),
            expense_date=strDate,
            description=dictItem.get("description", ""),
        ))
    return lsSummaries


# ── routes ────────────────────────────────────────────────────────────────────

@router.post("/draft", response_model=ReimbursementResponseSchema, status_code=status.HTTP_201_CREATED)
async def createDraft(
    objRequest: ReimbursementCreateRequest,
    dictCurrentUser: dict = Depends(getCurrentUserDependency),
):
    """
    Purpose : Create a new reimbursement in DRAFT status.
    Access  : Any authenticated user.
    """
    try:
        _validateBusinessTripDates(objRequest)
        _validateCategoryLimits(objRequest.items)

        objReimbs = get_collection("reimbursements")
        objUsers = get_collection("users")

        strUserId = dictCurrentUser["user_id"]
        dictUser = objUsers.find_one({"_id": ObjectId(strUserId)})
        if not dictUser:
            raise HTTPException(status_code=404, detail="User not found")

        dictNew = objRequest.model_dump()
        _serializeDatesForMongo(dictNew)
        dictNew["initiator_id"] = strUserId
        dictNew["initiator_name"] = dictUser.get("name", "")
        dictNew["status"] = "DRAFT"
        dictNew["form_type"] = objRequest.form_type.value
        dictNew["reimbursement_code"] = getNextReimbursementCode(str(datetime.now(timezone.utc).year))
        dictNew["created_at"] = datetime.now(timezone.utc).isoformat()
        dictNew["updated_at"] = datetime.now(timezone.utc).isoformat()

        objResult = objReimbs.insert_one(dictNew)
        dictNew["_id"] = objResult.inserted_id
        
        logMutation("reimbursements", None, dictNew, "INSERT", strUserId, str(objResult.inserted_id))
        
        return _docToResponse(dictNew)
    
    except HTTPException:
        raise
    except Exception as objErr:
        objLogger.error(f"❌ CREATE DRAFT ERROR: {objErr}")
        raise HTTPException(status_code=500, detail=str(objErr))


@router.put("/{reimbursement_id}/draft", response_model=ReimbursementResponseSchema)
async def updateDraft(
    reimbursement_id: str,
    objRequest: ReimbursementUpdateRequest,
    dictCurrentUser: dict = Depends(getCurrentUserDependency),
):
    """
    Purpose : Update a DRAFT reimbursement.
    Access  : Initiator only; DRAFT status only.
    """
    try:
        objReimbs = get_collection("reimbursements")
        strUserId = dictCurrentUser["user_id"]
        
        dictOld = objReimbs.find_one({"_id": ObjectId(reimbursement_id), "initiator_id": strUserId})
        if not dictOld:
            raise HTTPException(status_code=404, detail="Reimbursement not found")
        
        # Allow editing when reimbursement is a draft or returned for re-apply/query
        if dictOld.get("status") not in ("DRAFT", "QUERY_RAISED", "PRIVATE_ASK", "REAPPLIED", "CA_QUERY", "CA_REAPPLIED"):
            raise HTTPException(status_code=400, detail="Only DRAFT or queried reimbursements can be edited by the initiator")
        
        dictUpdates = objRequest.model_dump(exclude_unset=True)
        if not dictUpdates:
            raise HTTPException(status_code=400, detail="No updates provided")

        if objRequest.items is not None:
            _validateCategoryLimits(objRequest.items)
        _serializeDatesForMongo(dictUpdates)
        dictUpdates["updated_at"] = datetime.now(timezone.utc).isoformat()

        objReimbs.update_one({"_id": ObjectId(reimbursement_id)}, {"$set": dictUpdates})
        dictNew = objReimbs.find_one({"_id": ObjectId(reimbursement_id)})

        # Log field-level changes for edit tracking
        _logFieldChanges(reimbursement_id, strUserId, dictOld, dictNew)

        logMutation("reimbursements", dictOld, dictNew, "UPDATE", strUserId, reimbursement_id)

        return _docToResponse(dictNew)
    
    except HTTPException:
        raise
    except Exception as objErr:
        objLogger.error(f"❌ UPDATE DRAFT ERROR: {objErr}")
        raise HTTPException(status_code=500, detail=str(objErr))


@router.post("/{reimbursement_id}/submit", response_model=ReimbursementResponseSchema)
async def submitReimbursement(
    reimbursement_id: str,
    dictCurrentUser: dict = Depends(getCurrentUserDependency),
):
    """
    Purpose : Submit a DRAFT reimbursement (DRAFT → SUBMITTED).
    Access  : Initiator only; requires payment method.
    """
    try:
        objReimbs = get_collection("reimbursements")
        strUserId = dictCurrentUser["user_id"]

        # Check payment method
        if not hasAnyPaymentMethod(strUserId):
            raise HTTPException(
                status_code=400,
                detail="You must add a payment method before submitting a reimbursement. Go to Profile page."
            )

        dictOld = objReimbs.find_one({"_id": ObjectId(reimbursement_id), "initiator_id": strUserId})
        if not dictOld:
            raise HTTPException(status_code=404, detail="Reimbursement not found")

        strCurrentStatus = dictOld.get("status")
        bIsNewForm = strCurrentStatus == "DRAFT"
        bReapplyForQueryOrAsk = (strCurrentStatus == "PRIVATE_ASK") or (strCurrentStatus == "QUERY_RAISED")
        if (not bReapplyForQueryOrAsk) and (not bIsNewForm):
            raise HTTPException(status_code=400, detail=f"Cannot Submit Existing Form {strCurrentStatus}")

        # Build approval chain
        lsChain = buildChain(strUserId)
        if not lsChain:
            raise HTTPException(status_code=500, detail="Failed to build approval chain (no managers found)")

        dictUpdates = {
            "status": "SUBMITTED",
            "approval_chain": snapshotChain(lsChain),
            "current_step": 0,
            "current_reviewer_id": lsChain[0]["user_id"] if lsChain else None,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }

        objReimbs.update_one({"_id": ObjectId(reimbursement_id)}, {"$set": dictUpdates})
        dictNew = objReimbs.find_one({"_id": ObjectId(reimbursement_id)})

        logMutation("reimbursements", dictOld, dictNew, "UPDATE", strUserId, reimbursement_id)
        objLogger.info(f"✅ REIMBURSEMENT SUBMITTED: {reimbursement_id} by {strUserId}")

        # Notify the first reviewer that an approval is pending
        try:
            notifyAction(dictNew, "APPROVE", strUserId)
        except Exception as objNotifErr:
            objLogger.error(f"⚠️  Submit notification failed: {objNotifErr}")

        # Start SLA clock for the first reviewer
        try:
            strFirstReviewerId = lsChain[0]["user_id"] if lsChain else None
            if strFirstReviewerId:
                createSLAEvent(reimbursement_id, "REVIEW_PENDING", strFirstReviewerId)
        except Exception as objSLAErr:
            objLogger.error(f"⚠️  SLA event creation failed on submit: {objSLAErr}")

        return _docToResponse(dictNew)

    except HTTPException:
        raise
    except Exception as objErr:
        objLogger.error(f"❌ SUBMIT REIMBURSEMENT ERROR: {objErr}")
        raise HTTPException(status_code=500, detail=str(objErr))


@router.get("/my", response_model=List[ReimbursementListItemSchema])
async def listMyReimbursements(
    strBucket: Optional[str] = Query(None, alias="bucket", description="Filter by bucket: draft | pending | history"),
    dictCurrentUser: dict = Depends(getCurrentUserDependency),
):
    """
    Purpose : List reimbursements for the current user.
    Access  : Any authenticated user.
    """
    try:
        objReimbs = get_collection("reimbursements")
        strUserId = dictCurrentUser["user_id"]

        dictFilter = {"initiator_id": strUserId}

        if strBucket == "draft":
            dictFilter["status"] = "DRAFT"
        elif strBucket == "pending":
            dictFilter["status"] = {"$in": ["SUBMITTED", "IN_REVIEW", "QUERY_RAISED", "PRIVATE_ASK", "REAPPLIED", "OWNER_APPROVED", "CA_PENDING", "CA_QUERY", "CA_REAPPLIED", "PAID"]}
        elif strBucket == "history":
            dictFilter["status"] = {"$in": ["PAYMENT_ACKNOWLEDGED", "REJECTED", "AUTO_REJECTED", "CLOSED"]}

        lsDocs = list(objReimbs.find(dictFilter).sort("created_at", -1))

        # Batch-resolve category names in one DB query.
        dictNameMap = _resolveCategoryNames(lsDocs)

        lsResult = []
        for dictDoc in lsDocs:
            fTotal = sum(objItem.get("amount", 0) for objItem in dictDoc.get("items", []))
            lsResult.append(ReimbursementListItemSchema(
                reimbursement_id=str(dictDoc["_id"]),
                reimbursement_code=dictDoc.get("reimbursement_code"),
                initiator_id=str(dictDoc.get("initiator_id", "")),
                initiator_name=dictDoc.get("initiator_name", ""),
                form_type=dictDoc.get("form_type", "general"),
                status=dictDoc.get("status", "DRAFT"),
                description=dictDoc.get("description"),
                total_amount=fTotal,
                created_at=dictDoc.get("created_at", ""),
                updated_at=dictDoc.get("updated_at"),
                items=_buildItemSummaries(dictDoc, dictNameMap),
            ))

        return lsResult

    except Exception as objErr:
        objLogger.error(f"❌ LIST MY REIMBURSEMENTS ERROR: {objErr}")
        raise HTTPException(status_code=500, detail=str(objErr))


@router.get("/team", response_model=List[ReimbursementListItemSchema])
async def listTeamReimbursements(
    bucket: str = "pending-approvals",
    dictCurrentUser: dict = Depends(getCurrentUserDependency),
):
    """
    Purpose : List reimbursements involving the current user as reviewer OR manager.
    Buckets : pending-approvals  – current_reviewer_id == self, not terminal.
              pending-completion – in approval_chain (not current), not terminal.
              history            – created BY direct reports (creator-centric).
                                   Owner → all users' terminal reimbursements.
                                   CA    → fallback: approval_chain-based.
    Access  : Any authenticated user (filtered by role/chain).
    """
    try:
        objReimbs = get_collection("reimbursements")
        objUsers  = get_collection("users")
        strUserId = dictCurrentUser["user_id"]

        lsTerminal = ["PAYMENT_ACKNOWLEDGED", "REJECTED", "AUTO_REJECTED", "CLOSED"]

        if bucket == "pending-approvals":
            dictFilter = {"current_reviewer_id": strUserId, "status": {"$nin": lsTerminal}}
        elif bucket == "pending-completion":
            dictFilter = {
                "approval_chain.user_id": strUserId,
                "current_reviewer_id": {"$ne": strUserId},
                "status": {"$nin": lsTerminal},
            }
        elif bucket == "history":
            # ── Creator-centric Team History ──────────────────────────────────
            # Determine the current user's role(s).
            dictMe = objUsers.find_one({"_id": ObjectId(strUserId)})
            lsMyRoles = [d.get("role", "") for d in (dictMe or {}).get("departments", [])]
            bIsOwner = "owner" in lsMyRoles
            bIsCA    = "ca"    in lsMyRoles

            if bIsOwner:
                # Owner's team = everyone in the company (excluding themselves).
                dictFilter = {
                    "initiator_id": {"$ne": strUserId},
                    "status": {"$in": lsTerminal},
                }
            elif bIsCA:
                # CA reviews all but manages no one in the org chart.
                # Fall back to approval-chain membership so CA can still see
                # finalized reimbursements they were involved in.
                dictFilter = {
                    "approval_chain.user_id": strUserId,
                    "initiator_id": {"$ne": strUserId},
                    "status": {"$in": lsTerminal},
                }
            else:
                # Regular manager / senior_manager:
                # Find direct reports – users whose managers list includes me.
                lsTeamDocs = list(objUsers.find(
                    {"managers.manager_id": strUserId, "is_active": True},
                    {"_id": 1},
                ))
                lsTeamIds = [str(d["_id"]) for d in lsTeamDocs]

                if lsTeamIds:
                    dictFilter = {
                        "initiator_id": {"$in": lsTeamIds},
                        "status": {"$in": lsTerminal},
                    }
                else:
                    # No direct reports configured yet – show nothing.
                    return []
        else:
            raise HTTPException(status_code=400, detail=f"Invalid bucket: {bucket}")

        lsDocs = list(objReimbs.find(dictFilter).sort("updated_at", -1))

        # Batch-resolve category names in one DB query.
        dictNameMap = _resolveCategoryNames(lsDocs)

        lsResult = []
        for dictDoc in lsDocs:
            fTotal = sum(objItem.get("amount", 0) for objItem in dictDoc.get("items", []))
            lsResult.append(ReimbursementListItemSchema(
                reimbursement_id=str(dictDoc["_id"]),
                reimbursement_code=dictDoc.get("reimbursement_code"),
                initiator_id=str(dictDoc.get("initiator_id", "")),
                initiator_name=dictDoc.get("initiator_name", ""),
                form_type=dictDoc.get("form_type", "general"),
                status=dictDoc.get("status", "DRAFT"),
                description=dictDoc.get("description"),
                total_amount=fTotal,
                created_at=dictDoc.get("created_at", ""),
                updated_at=dictDoc.get("updated_at"),
                items=_buildItemSummaries(dictDoc, dictNameMap),
            ))

        return lsResult

    except HTTPException:
        raise
    except Exception as objErr:
        objLogger.error(f"❌ LIST TEAM REIMBURSEMENTS ERROR: {objErr}")
        raise HTTPException(status_code=500, detail=str(objErr))


@router.get("/{reimbursement_id}", response_model=ReimbursementResponseSchema)
async def getReimbursementDetail(
    reimbursement_id: str,
    dictCurrentUser: dict = Depends(getCurrentUserDependency),
):
    """
    Purpose : Get detailed view of a reimbursement.
    Access  : Initiator, chain participants, Owner/CA.
    """
    try:
        objReimbs = get_collection("reimbursements")

        dictDoc = objReimbs.find_one({"_id": ObjectId(reimbursement_id)})
        if not dictDoc:
            raise HTTPException(status_code=404, detail="Reimbursement not found")

        # TODO Phase 8: Add chain-based access control

        # Log page view
        logView(reimbursement_id, dictCurrentUser["user_id"])

        return _docToResponse(dictDoc)

    except HTTPException:
        raise
    except Exception as objErr:
        objLogger.error(f"❌ GET REIMBURSEMENT DETAIL ERROR: {objErr}")
        raise HTTPException(status_code=500, detail=str(objErr))


@router.delete("/{reimbursement_id}", status_code=status.HTTP_204_NO_CONTENT)
async def deleteReimbursement(
    reimbursement_id: str,
    dictCurrentUser: dict = Depends(getCurrentUserDependency),
):
    """
    Purpose : Delete a DRAFT reimbursement.
    Access  : Initiator only; DRAFT status only.
    """
    try:
        objReimbs = get_collection("reimbursements")
        strUserId = dictCurrentUser["user_id"]

        dictOld = objReimbs.find_one({"_id": ObjectId(reimbursement_id), "initiator_id": strUserId})
        if not dictOld:
            raise HTTPException(status_code=404, detail="Reimbursement not found")

        if dictOld.get("status") != "DRAFT":
            raise HTTPException(status_code=400, detail="Only DRAFT reimbursements can be deleted")

        objReimbs.delete_one({"_id": ObjectId(reimbursement_id)})
        logMutation("reimbursements", dictOld, None, "DELETE", strUserId, reimbursement_id)

        return None

    except HTTPException:
        raise
    except Exception as objErr:
        objLogger.error(f"❌ DELETE REIMBURSEMENT ERROR: {objErr}")
        raise HTTPException(status_code=500, detail=str(objErr))


@router.get("/{reimbursement_id}/chain")
async def getReimbursementChain(
    reimbursement_id: str,
    dictCurrentUser: dict = Depends(getCurrentUserDependency),
):
    """
    Purpose : Get approval chain and visible logs for a reimbursement.
    Access  : Initiator, chain participants, Owner/CA.
    """
    try:
        objReimbs = get_collection("reimbursements")
        objLogs = get_collection("reimbursement_logs")

        dictDoc = objReimbs.find_one({"_id": ObjectId(reimbursement_id)})
        if not dictDoc:
            raise HTTPException(status_code=404, detail="Reimbursement not found")

        strUserId = dictCurrentUser["user_id"]
        strPrimaryRole = dictCurrentUser.get("primary_role", "")

        # Access control: initiator, chain participants, owner/ca can view the chain.
        bIsInitiator = str(dictDoc.get("initiator_id", "")) == strUserId
        bIsInChain = any(str(step.get("user_id", "")) == strUserId for step in dictDoc.get("approval_chain", []))
        bIsAdmin = strPrimaryRole in ["owner"]
        bIsOwner = strPrimaryRole == "owner"

        if not (bIsInitiator or bIsInChain or bIsAdmin):
            raise HTTPException(status_code=403, detail="Access denied")

        # Fetch logs
        lsLogs = list(objLogs.find({"reimbursement_id": reimbursement_id}).sort("created_at", 1))

        # Filter logs based on visibility.
        # Private logs are visible only to: the sender, the initiator, and the Owner.
        # Manager / Senior Manager / CA must NOT see private Asks.
        lsVisibleLogs = []
        for dictLog in lsLogs:
            strVisibility = dictLog.get("visibility", "public")
            if strVisibility == "public":
                lsVisibleLogs.append(dictLog)
            elif strVisibility == "private":
                strActionBy = str(dictLog.get("action_by", ""))
                if strActionBy == strUserId or bIsInitiator or bIsOwner:
                    lsVisibleLogs.append(dictLog)

        # Enrich logs with actor name / email / role / department.
        # Batch-fetch users and departments once to avoid N+1 queries.
        objUsers = get_collection("users")
        objDepts = get_collection("departments")

        setActorIds = set()
        for dictLog in lsVisibleLogs:
            strActorId = str(dictLog.get("action_by", ""))
            if strActorId:
                try:
                    setActorIds.add(ObjectId(strActorId))
                except Exception:
                    pass

        dictUserMap = {}
        setDeptIds = set()
        if setActorIds:
            for dictU in objUsers.find({"_id": {"$in": list(setActorIds)}}):
                lsDepts = dictU.get("departments", [])
                dictPrimary = next((d for d in lsDepts if d.get("is_primary")), lsDepts[0] if lsDepts else {})
                strDeptName = dictPrimary.get("department_name", "")
                strDeptId = str(dictPrimary.get("department_id", "")) if dictPrimary else ""
                if not strDeptName and strDeptId:
                    try:
                        setDeptIds.add(ObjectId(strDeptId))
                    except Exception:
                        pass
                dictUserMap[str(dictU["_id"])] = {
                    "name": dictU.get("name", ""),
                    "email": dictU.get("email", ""),
                    "role": dictPrimary.get("role", "") if dictPrimary else "",
                    "department": strDeptName,
                    "department_id": strDeptId,
                }

        dictDeptNameMap = {}
        if setDeptIds:
            for dictD in objDepts.find({"_id": {"$in": list(setDeptIds)}}, {"name": 1}):
                dictDeptNameMap[str(dictD["_id"])] = dictD.get("name", "")

        # Serialize logs with enriched actor info
        for dictLog in lsVisibleLogs:
            dictLog["log_id"] = str(dictLog.pop("_id"))
            dictInfo = dictUserMap.get(str(dictLog.get("action_by", "")), {})
            strDept = dictInfo.get("department", "") or dictDeptNameMap.get(dictInfo.get("department_id", ""), "")
            dictLog["action_by_name"] = dictInfo.get("name", "")
            dictLog["action_by_email"] = dictInfo.get("email", "")
            dictLog["action_by_role"] = dictInfo.get("role", "")
            dictLog["action_by_department"] = strDept

        return {
            "approval_chain": dictDoc.get("approval_chain", []),
            "current_step": dictDoc.get("current_step", 0),
            "current_reviewer_id": dictDoc.get("current_reviewer_id", ""),
            "logs": lsVisibleLogs,
        }

    except HTTPException:
        raise
    except Exception as objErr:
        objLogger.error(f"❌ GET REIMBURSEMENT CHAIN ERROR: {objErr}")
        raise HTTPException(status_code=500, detail=str(objErr))


@router.get("/{reimbursement_id}/logs", response_model=List[ActivityLogSchema])
async def getReimbursementLogs(
    reimbursement_id: str,
    log_types: Optional[str] = Query(None, description="Comma-separated: edit,activity,view"),
    dictCurrentUser: dict = Depends(getCurrentUserDependency),
):
    """
    Purpose : Fetch all logs for a reimbursement, filtered by type.
    Access  : Initiator, chain participants, Owner/CA.

    Query Params:
      - log_types: "edit,activity,view" (default: all types)
    """
    try:
        objReimbs = get_collection("reimbursements")
        objLogs = get_collection("reimbursement_logs")

        # Verify reimbursement exists
        dictDoc = objReimbs.find_one({"_id": ObjectId(reimbursement_id)})
        if not dictDoc:
            raise HTTPException(status_code=404, detail="Reimbursement not found")

        # TODO Phase 8: Add chain-based access control

        # Parse log_types filter
        lsFilterTypes = []
        if log_types:
            lsFilterTypes = [s.strip() for s in log_types.split(",") if s.strip() in ["edit", "activity", "view"]]

        # Build query
        dictQuery = {"reimbursement_id": reimbursement_id}
        if lsFilterTypes:
            dictQuery["log_type"] = {"$in": lsFilterTypes}

        # Fetch logs
        lsLogs = list(objLogs.find(dictQuery).sort("created_at", -1))

        # Serialize
        lsResult = []
        for dictLog in lsLogs:
            dictLog["log_id"] = str(dictLog.pop("_id"))
            # Ensure all required fields exist
            dictLog.setdefault("action_by_name", "Unknown")
            dictLog.setdefault("action_by_email", "unknown@example.com")
            dictLog.setdefault("action_by_role", None)
            dictLog.setdefault("action_by_department", None)
            dictLog.setdefault("field_name", None)
            dictLog.setdefault("old_value", None)
            dictLog.setdefault("new_value", None)
            dictLog.setdefault("old_status", None)
            dictLog.setdefault("new_status", None)
            dictLog.setdefault("message", None)
            dictLog.setdefault("visibility", "public")
            lsResult.append(dictLog)

        return lsResult

    except HTTPException:
        raise
    except Exception as objErr:
        objLogger.error(f"❌ GET REIMBURSEMENT LOGS ERROR: {objErr}")
        raise HTTPException(status_code=500, detail=str(objErr))
