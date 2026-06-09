'''
Purpose : In-app notification routes (list, mark-read, mark-all-read, delete).

Inputs  : HTTP requests (query params, JSON bodies).

Output  : JSON success/error responses with notification metadata.

Dependencies: fastapi, mongodb_config, jwt_middleware, notification_schemas
'''
import logging
from bson import ObjectId
from fastapi import APIRouter, HTTPException, status, Depends, Query

from config.mongodb_config import get_collection
from middleware.jwt_middleware import getCurrentUserDependency
from schemas.notification_schemas import (
    NotificationListResponse,
    NotificationResponseSchema,
    MarkReadRequest,
)

objLogger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/notifications", tags=["Notifications"])


def _docToResponse(dictDoc: dict) -> NotificationResponseSchema:
    return NotificationResponseSchema(
        notification_id=str(dictDoc.get("_id", "")),
        user_id=str(dictDoc.get("user_id", "")),
        type=dictDoc.get("type", ""),
        title=dictDoc.get("title", ""),
        message=dictDoc.get("message", ""),
        reimbursement_id=dictDoc.get("reimbursement_id"),
        is_read=dictDoc.get("is_read", False),
        created_at=dictDoc.get("created_at", ""),
        html_content=dictDoc.get("html_content"),
        metadata=dictDoc.get("metadata"),
    )


@router.get("/list", response_model=NotificationListResponse)
async def listNotifications(
    limit: int = Query(50, ge=1, le=200),
    unread_only: bool = Query(False),
    dictCurrentUser: dict = Depends(getCurrentUserDependency),
):
    """
    Purpose : List notifications for the current user (newest first).
    """
    print(f"[notification_routes][listNotifications]")
    try:
        objNotifs = get_collection("notifications")
        strUserId = dictCurrentUser["user_id"]

        dictFilter = {"user_id": strUserId}
        if unread_only:
            dictFilter["is_read"] = False

        lsDocs = list(objNotifs.find(dictFilter).sort("created_at", -1).limit(limit))
        iUnread = objNotifs.count_documents({"user_id": strUserId, "is_read": False})

        return NotificationListResponse(
            notifications=[_docToResponse(d) for d in lsDocs],
            unread_count=iUnread,
        )
    except Exception as objErr:
        objLogger.error(f"❌ LIST NOTIFICATIONS ERROR: {objErr}")
        raise HTTPException(status_code=500, detail=str(objErr))


@router.get("/unread-count")
async def getUnreadCount(
    dictCurrentUser: dict = Depends(getCurrentUserDependency),
):
    """Lightweight endpoint for the bell icon badge."""
    print(f"[notification_routes][getUnreadCount]")
    try:
        objNotifs = get_collection("notifications")
        iCount = objNotifs.count_documents({
            "user_id": dictCurrentUser["user_id"],
            "is_read": False,
        })
        return {"unread_count": iCount}
    except Exception as objErr:
        objLogger.error(f"❌ UNREAD COUNT ERROR: {objErr}")
        raise HTTPException(status_code=500, detail=str(objErr))


@router.post("/mark-read", status_code=status.HTTP_200_OK)
async def markRead(
    objRequest: MarkReadRequest,
    dictCurrentUser: dict = Depends(getCurrentUserDependency),
):
    """
    Purpose : Mark notifications as read (specific IDs or all for the user).
    """
    print(f"[notification_routes][markRead]")
    try:
        objNotifs = get_collection("notifications")
        strUserId = dictCurrentUser["user_id"]

        if objRequest.mark_all:
            objResult = objNotifs.update_many(
                {"user_id": strUserId, "is_read": False},
                {"$set": {"is_read": True}},
            )
            return {"success": True, "updated": objResult.modified_count}

        if not objRequest.notification_ids:
            return {"success": True, "updated": 0}

        lsIds = []
        for strId in objRequest.notification_ids:
            try:
                lsIds.append(ObjectId(strId))
            except Exception:
                continue

        objResult = objNotifs.update_many(
            {"_id": {"$in": lsIds}, "user_id": strUserId},
            {"$set": {"is_read": True}},
        )
        return {"success": True, "updated": objResult.modified_count}
    except Exception as objErr:
        objLogger.error(f"❌ MARK READ ERROR: {objErr}")
        raise HTTPException(status_code=500, detail=str(objErr))


@router.delete("/{notification_id}", status_code=status.HTTP_200_OK)
async def deleteNotification(
    notification_id: str,
    dictCurrentUser: dict = Depends(getCurrentUserDependency),
):
    """Delete a single notification owned by the current user."""
    print(f"[notification_routes][deleteNotification]")
    try:
        objNotifs = get_collection("notifications")
        objResult = objNotifs.delete_one({
            "_id": ObjectId(notification_id),
            "user_id": dictCurrentUser["user_id"],
        })
        if objResult.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Notification not found")
        return {"success": True}
    except HTTPException:
        raise
    except Exception as objErr:
        objLogger.error(f"❌ DELETE NOTIFICATION ERROR: {objErr}")
        raise HTTPException(status_code=500, detail=str(objErr))
