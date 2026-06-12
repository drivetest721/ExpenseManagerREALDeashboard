'''
Purpose : Generate user-specific daily reimbursement IDs in format RB{DDMMYYYY}-{username}-{count}
          Tracks daily submission counts per user in reimbursement_lookup collection.

Inputs  : User ID and username

Output  : Unique reimbursement ID string

Dependencies: config.mongodb_config, datetime
'''

import logging
import sys
import os
from datetime import datetime, timezone
from typing import Tuple
from bson import ObjectId

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config.mongodb_config import get_collection
from utils.date_utils import getCurrentIst

objLogger = logging.getLogger(__name__)


def generateReimbursementId(strUserId: str, strUsername: str) -> str:
    """
    Purpose : Generate new reimbursement ID for current date.
              Format: RB{DDMMYYYY}-{username}-{count}
              Uses atomic $inc on reimbursement_lookup collection.

    Inputs  :   (1) strUserId   : User ID (str)
                (2) strUsername : User name for ID (str)

    Output  : Unique reimbursement ID string

    Example : strId = generateReimbursementId("user123", "aryan")
              # "RB10062026-aryan-1"
              
              strId2 = generateReimbursementId("user123", "aryan")  # same day
              # "RB10062026-aryan-2"

    Notes   : - Resets daily per user
              - Uses find_one_and_update with upsert=True for atomic increment
              - Username is sanitized (lowercase, no spaces)
    """
    try:
        objLogger.info(f"📥 GENERATING REIMBURSEMENT ID for user: {strUserId} | username: {strUsername}")

        # Get current date in IST timezone
        dtNow = getCurrentIst()
        strDate = dtNow.strftime("%d%m%Y")  # Example: "10062026"
        strDateKey = dtNow.strftime("%Y-%m-%d")  # Example: "2026-06-10"
        
        # Sanitize username: lowercase, remove spaces
        strSanitizedUsername = strUsername.lower().replace(" ", "").replace("-", "")
        
        # Atomic increment counter for this user on this date
        objLookup = get_collection("reimbursement_lookup")
        
        dictResult = objLookup.find_one_and_update(
            {
                "user_id": strUserId,
                "date": strDateKey
            },
            {
                "$inc": {"count": 1},
                "$setOnInsert": {
                    "username": strSanitizedUsername,
                    "created_at": dtNow.isoformat()
                }
            },
            upsert=True,
            return_document=True  # Return document AFTER update
        )
        
        iCount = dictResult["count"]
        
        # Format: RB{DDMMYYYY}-{username}-{count}
        strReimbursementId = f"RB{strDate}-{strSanitizedUsername}-{iCount}"
        
        objLogger.info(f"✅ Generated reimbursement ID: {strReimbursementId}")
        return strReimbursementId
    
    except Exception as objErr:
        objLogger.error(f"❌ Error generating reimbursement ID: {str(objErr)}")
        raise Exception(f"Failed to generate reimbursement ID: {str(objErr)}")


def getTodaySubmissionCount(strUserId: str) -> int:
    """
    Purpose : Get current user's submission count for today

    Inputs  :   (1) strUserId : User ID (str)

    Output  : Integer count (0 if no submissions today)

    Example : iCount = getTodaySubmissionCount("user123")
              # 2
    """
    try:
        dtNow = getCurrentIst()
        strDateKey = dtNow.strftime("%Y-%m-%d")
        
        objLookup = get_collection("reimbursement_lookup")
        dictLookup = objLookup.find_one({
            "user_id": strUserId,
            "date": strDateKey
        })
        
        return dictLookup["count"] if dictLookup else 0
    
    except Exception as objErr:
        objLogger.error(f"❌ Error getting today's count: {str(objErr)}")
        return 0


def getUserSubmissionHistory(strUserId: str, strStartDate: str, strEndDate: str) -> list:
    """
    Purpose : Get user's submission history for a date range

    Inputs  :   (1) strUserId    : User ID (str)
                (2) strStartDate : Start date "YYYY-MM-DD" (str)
                (3) strEndDate   : End date "YYYY-MM-DD" (str)

    Output  : List of submission records

    Example : lsHistory = getUserSubmissionHistory("user123", "2026-06-01", "2026-06-30")
              # [{"date": "2026-06-10", "count": 3, "username": "aryan"}, ...]
    """
    try:
        objLookup = get_collection("reimbursement_lookup")
        lsRecords = list(objLookup.find({
            "user_id": strUserId,
            "date": {"$gte": strStartDate, "$lte": strEndDate}
        }).sort("date", -1))
        
        return [{
            "date": rec["date"],
            "count": rec["count"],
            "username": rec.get("username", "")
        } for rec in lsRecords]
    
    except Exception as objErr:
        objLogger.error(f"❌ Error getting submission history: {str(objErr)}")
        return []
