'''
Purpose : Holiday management endpoints.
          Company holidays are excluded from business-day SLA calculations.

Inputs  : HTTP requests (JSON body for create, path param for delete).

Output  : JSON responses with holiday list / confirmation.

Dependencies: fastapi, config.mongodb_config, middleware.jwt_middleware
'''

import logging
from datetime import datetime, timezone
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from bson import ObjectId
from pydantic import BaseModel, Field

from config.mongodb_config import get_collection
from middleware.jwt_middleware import getAdminUserDependency, getCurrentUserDependency

objLogger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/holidays", tags=["Holidays"])


# ── Schemas (inline — simple enough to not warrant a separate file) ────────────

class HolidayCreateRequest(BaseModel):
    date: str = Field(..., description="ISO date string YYYY-MM-DD")
    name: str = Field(..., min_length=1, max_length=100, description="Holiday name")


class HolidayResponseSchema(BaseModel):
    holiday_id: str
    date: str
    name: str
    created_at: str
    created_by: str


# ── Helpers ────────────────────────────────────────────────────────────────────

def _docToResponse(doc: dict) -> HolidayResponseSchema:
    return HolidayResponseSchema(
        holiday_id=str(doc["_id"]),
        date=doc.get("date_str", str(doc.get("date", ""))),
        name=doc.get("name", ""),
        created_at=doc.get("created_at", ""),
        created_by=doc.get("created_by", ""),
    )


# ── Routes ─────────────────────────────────────────────────────────────────────

@router.get("/list", response_model=List[HolidayResponseSchema])
async def listHolidays(
    dictCurrentUser: dict = Depends(getCurrentUserDependency),
):
    """
    Purpose : List all holidays sorted by date.
    Access  : Any authenticated user.
    """
    try:
        objHolidays = get_collection("holidays")
        lsDocs = list(objHolidays.find({}).sort("date_str", 1))
        return [_docToResponse(doc) for doc in lsDocs]
    except Exception as objErr:
        objLogger.error(f"❌ LIST HOLIDAYS ERROR: {objErr}")
        raise HTTPException(status_code=500, detail=str(objErr))


@router.post("/create", response_model=HolidayResponseSchema, status_code=status.HTTP_201_CREATED)
async def createHoliday(
    objRequest: HolidayCreateRequest,
    dictCurrentUser: dict = Depends(getAdminUserDependency),
):
    """
    Purpose : Add a company holiday.
    Access  : Admin (Owner/CA).
    """
    try:
        objHolidays = get_collection("holidays")

        # Validate date format
        try:
            dtParsed = datetime.strptime(objRequest.date, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")

        # Check for duplicate
        if objHolidays.find_one({"date_str": objRequest.date}):
            raise HTTPException(status_code=409, detail=f"Holiday on {objRequest.date} already exists.")

        dtNow = datetime.now(timezone.utc)
        dictDoc = {
            "date": dtParsed,          # datetime for SLA engine date lookups
            "date_str": objRequest.date,  # string for easy display / dedup
            "name": objRequest.name.strip(),
            "created_at": dtNow.isoformat(),
            "created_by": dictCurrentUser["user_id"],
        }
        objResult = objHolidays.insert_one(dictDoc)
        dictDoc["_id"] = objResult.inserted_id

        objLogger.info(f"✅ HOLIDAY CREATED: {objRequest.date} — {objRequest.name}")
        return _docToResponse(dictDoc)

    except HTTPException:
        raise
    except Exception as objErr:
        objLogger.error(f"❌ CREATE HOLIDAY ERROR: {objErr}")
        raise HTTPException(status_code=500, detail=str(objErr))


@router.delete("/{holiday_id}", status_code=status.HTTP_204_NO_CONTENT)
async def deleteHoliday(
    holiday_id: str,
    dictCurrentUser: dict = Depends(getAdminUserDependency),
):
    """
    Purpose : Remove a company holiday by ID.
    Access  : Admin (Owner/CA).
    """
    try:
        objHolidays = get_collection("holidays")
        objResult = objHolidays.delete_one({"_id": ObjectId(holiday_id)})
        if objResult.deleted_count == 0:
            raise HTTPException(status_code=404, detail="Holiday not found.")
        objLogger.info(f"🗑  HOLIDAY DELETED: {holiday_id}")
    except HTTPException:
        raise
    except Exception as objErr:
        objLogger.error(f"❌ DELETE HOLIDAY ERROR: {objErr}")
        raise HTTPException(status_code=500, detail=str(objErr))
