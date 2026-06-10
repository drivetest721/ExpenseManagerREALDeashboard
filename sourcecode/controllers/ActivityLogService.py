'''
Purpose : Service for logging all reimbursement-related activities.
          Provides unified logging for edits, workflow activities, and page views.

Inputs  : Reimbursement ID, actor ID, log type, action details.

Output  : Inserts documents into the `reimbursement_logs` collection.

Dependencies: config.mongodb_config, datetime, typing
'''

import logging
from datetime import datetime, timezone, timedelta
from typing import Optional
from bson import ObjectId

import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config.mongodb_config import get_collection

objLogger = logging.getLogger(__name__)


def _getUserDetails(strUserId: str) -> dict:
    """
    Purpose : Fetch user details for logging.
    
    Inputs  : strUserId - User ID (str)
    
    Output  : Dict with name, email, role, department
    """
    try:
        objUsers = get_collection("users")
        dictUser = objUsers.find_one({"_id": ObjectId(strUserId)})
        
        if not dictUser:
            return {
                "name": "Unknown User",
                "email": "unknown@example.com",
                "role": None,
                "department": None,
            }
        
        # Get primary department/role
        lsDepts = dictUser.get("departments", [])
        strRole = None
        strDept = None
        
        if lsDepts:
            strRole = lsDepts[0].get("role")
            strDeptId = lsDepts[0].get("department_id")
            
            if strDeptId:
                objDepts = get_collection("departments")
                dictDept = objDepts.find_one({"department_id": strDeptId})
                if not dictDept:
                    try:
                        dictDept = objDepts.find_one({"_id": ObjectId(strDeptId)})
                    except:
                        pass
                if dictDept:
                    strDept = dictDept.get("department_name")
        
        return {
            "name": dictUser.get("name", "Unknown"),
            "email": dictUser.get("email", "unknown@example.com"),
            "role": strRole,
            "department": strDept,
        }
    except Exception as objErr:
        objLogger.error(f"❌ Failed to fetch user details for {strUserId}: {objErr}")
        return {
            "name": "Unknown User",
            "email": "unknown@example.com",
            "role": None,
            "department": None,
        }


def logEdit(
    strReimbursementId: str,
    strActorId: str,
    strFieldName: str,
    strOldValue: Optional[str],
    strNewValue: str,
    strAction: str = "FIELD_CHANGED",
) -> str:
    """
    Purpose : Log a form field edit.
    
    Inputs  : (1) strReimbursementId - Reimbursement ID (str)
              (2) strActorId - User who made the edit (str)
              (3) strFieldName - Name of the field changed (str)
              (4) strOldValue - Previous value (str or None)
              (5) strNewValue - New value (str)
              (6) strAction - Action type (default: FIELD_CHANGED)
    
    Output  : Inserted log ID as string
    
    Example : logEdit("reimb_123", "user_123", "category", "Travel", "Food")
    """
    try:
        objLogs = get_collection("reimbursement_logs")
        dictUser = _getUserDetails(strActorId)
        
        dictLog = {
            "reimbursement_id": strReimbursementId,
            "log_type": "edit",
            "action": strAction,
            "action_by": strActorId,
            "action_by_name": dictUser["name"],
            "action_by_email": dictUser["email"],
            "action_by_role": dictUser["role"],
            "action_by_department": dictUser["department"],
            "field_name": strFieldName,
            "old_value": strOldValue or "-",
            "new_value": strNewValue,
            "visibility": "public",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        
        objResult = objLogs.insert_one(dictLog)
        strLogId = str(objResult.inserted_id)
        
        objLogger.info(f"✅ Edit logged | reimb={strReimbursementId} | field={strFieldName} | actor={strActorId}")
        return strLogId
        
    except Exception as objErr:
        objLogger.error(f"❌ Failed to log edit: {objErr}")
        return ""


def logActivity(
    strReimbursementId: str,
    strActorId: str,
    strAction: str,
    strOldStatus: Optional[str],
    strNewStatus: str,
    strMessage: str = "",
    strVisibility: str = "public",
) -> str:
    """
    Purpose : Log a workflow activity (submit, approve, query, reject, etc.).
    
    Inputs  : (1) strReimbursementId - Reimbursement ID (str)
              (2) strActorId - User who performed the action (str)
              (3) strAction - Action type (e.g., SUBMITTED, APPROVED)
              (4) strOldStatus - Previous status (str or None)
              (5) strNewStatus - New status (str)
              (6) strMessage - Optional message/description (str)
              (7) strVisibility - "public" or "private" (str)
    
    Output  : Inserted log ID as string

    Example : logActivity("reimb_123", "user_123", "SUBMITTED", "DRAFT", "IN_REVIEW", "Submitted for approval")
    """
    try:
        objLogs = get_collection("reimbursement_logs")
        dictUser = _getUserDetails(strActorId)

        dictLog = {
            "reimbursement_id": strReimbursementId,
            "log_type": "activity",
            "action": strAction,
            "action_by": strActorId,
            "action_by_name": dictUser["name"],
            "action_by_email": dictUser["email"],
            "action_by_role": dictUser["role"],
            "action_by_department": dictUser["department"],
            "old_status": strOldStatus or "-",
            "new_status": strNewStatus,
            "message": strMessage,
            "visibility": strVisibility,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }

        objResult = objLogs.insert_one(dictLog)
        strLogId = str(objResult.inserted_id)

        objLogger.info(f"✅ Activity logged | reimb={strReimbursementId} | action={strAction} | actor={strActorId}")
        return strLogId

    except Exception as objErr:
        objLogger.error(f"❌ Failed to log activity: {objErr}")
        return ""


def logView(
    strReimbursementId: str,
    strActorId: str,
) -> str:
    """
    Purpose : Log when a user views the reimbursement detail page.
              Rate-limited: Max 1 view log per user per reimbursement per 5 minutes.
              ALSO updates approval_chain[current_step].received_date if this is the first view.

    Inputs  : (1) strReimbursementId - Reimbursement ID (str)
              (2) strActorId - User who viewed the page (str)

    Output  : Inserted log ID as string (empty if rate-limited)

    Example : logView("reimb_123", "manager_456")
    """
    try:
        from bson import ObjectId
        objLogs = get_collection("reimbursement_logs")
        objReimbs = get_collection("reimbursements")

        # Rate limiting: Check for recent view logs from this user
        dtThreshold = datetime.now(timezone.utc) - timedelta(minutes=5)
        dictRecent = objLogs.find_one({
            "reimbursement_id": strReimbursementId,
            "log_type": "view",
            "action_by": strActorId,
            "created_at": {"$gte": dtThreshold.isoformat()},
        })

        if dictRecent:
            objLogger.debug(f"⏭️ View log rate-limited for user={strActorId} reimb={strReimbursementId}")
            return ""

        dictUser = _getUserDetails(strActorId)
        strNow = datetime.now(timezone.utc).isoformat()

        dictLog = {
            "reimbursement_id": strReimbursementId,
            "log_type": "view",
            "action": "PAGE_VIEWED",
            "action_by": strActorId,
            "action_by_name": dictUser["name"],
            "action_by_email": dictUser["email"],
            "action_by_role": dictUser["role"],
            "action_by_department": dictUser["department"],
            "visibility": "public",
            "created_at": strNow,
        }

        objResult = objLogs.insert_one(dictLog)
        strLogId = str(objResult.inserted_id)

        objLogger.info(f"✅ View logged | reimb={strReimbursementId} | actor={strActorId}")

        # UPDATE APPROVAL CHAIN: Set received_date for current reviewer if not already set
        try:
            dictReimb = objReimbs.find_one({"_id": ObjectId(strReimbursementId)})
            if dictReimb:
                strCurrentReviewerId = str(dictReimb.get("current_reviewer_id", ""))
                iCurrentStep = dictReimb.get("current_step", 0)
                lsChain = dictReimb.get("approval_chain", [])

                # If this user is the current reviewer and viewing for the first time
                if strActorId == strCurrentReviewerId and iCurrentStep < len(lsChain):
                    # Check if received_date is not already set
                    if not lsChain[iCurrentStep].get("received_date"):
                        # Update the approval_chain array with received_date
                        objReimbs.update_one(
                            {"_id": ObjectId(strReimbursementId)},
                            {"$set": {f"approval_chain.{iCurrentStep}.received_date": strNow}}
                        )
                        objLogger.info(f"📬 Set received_date for step {iCurrentStep} | reimb={strReimbursementId}")
        except Exception as updateErr:
            objLogger.warning(f"⚠️ Failed to update approval_chain received_date: {updateErr}")

        return strLogId

    except Exception as objErr:
        objLogger.error(f"❌ Failed to log view: {objErr}")
        return ""
    
