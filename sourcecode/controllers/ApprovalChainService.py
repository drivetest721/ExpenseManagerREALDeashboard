'''
Purpose : Create and manage enhanced embedded approval chains in reimbursement documents
          with detailed step tracking (receivedAt, submittedAt, bIsReApply)

Inputs  : User ID, reimbursement data

Output  : Enhanced approval chain array for embedding

Dependencies: config.mongodb_config, ApprovalChainEngine, datetime
'''

import logging
import sys
import os
from datetime import datetime, timezone
from typing import List, Dict, Optional
from bson import ObjectId

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config.mongodb_config import get_collection
from controllers.ApprovalChainEngine import build_approval_chain_for_reimbursement
from utils.date_utils import getCurrentIst

objLogger = logging.getLogger(__name__)


def createEmbeddedApprovalChain(strInitiatorId: str) -> List[Dict]:
    """
    Purpose : Create enhanced approval chain array for embedding in reimbursement.
              Includes detailed step tracking with receivedAt, submittedAt, bIsReApply.

    Inputs  :   (1) strInitiatorId : Initiator user ID (str)

    Output  : List of approval chain step dicts

    Example : lsChain = createEmbeddedApprovalChain("user123")
              # [
              #   {
              #     "step": 0,
              #     "user_id": "user123",
              #     "username": "Aryan Nayak",
              #     "role": "initiator",
              #     "current_status": "SUBMITTED",
              #     "receivedAt": None,
              #     "submittedAt": "2026-06-10T12:00:00Z",
              #     "bIsReApply": False
              #   },
              #   {
              #     "step": 1,
              #     "user_id": "mgr123",
              #     "username": "Manager Name",
              #     "role": "manager",
              #     "current_status": "PENDING",
              #     "receivedAt": None,
              #     "submittedAt": None,
              #     "bIsReApply": False
              #   }
              # ]

    Notes   : - Step 0 is always the initiator
              - bIsReApply is only for initiator (tracks if resubmitted after query/ask)
              - receivedAt set when reviewer opens reimbursement
              - submittedAt set when reviewer takes action
    """
    try:
        objLogger.info(f"📥 CREATING EMBEDDED APPROVAL CHAIN for initiator: {strInitiatorId}")
        
        objUsers = get_collection("users")
        
        # Build approval chain using existing engine
        dictTree, lsChain = build_approval_chain_for_reimbursement(strInitiatorId)
        lsChain = lsChain[1:]  # Remove initiator from chain as we will add enhanced initiator step
        
        # Get initiator info
        dictInitiator = objUsers.find_one({"_id": ObjectId(strInitiatorId)})
        if not dictInitiator:
            objLogger.error(f"❌ Initiator not found: {strInitiatorId}")
            raise Exception(f"Initiator not found: {strInitiatorId}")
        
        # Build enhanced chain array
        dtNow = getCurrentIst()
        lsEnhancedChain = [
            {
                "step": 0,
                "user_id": strInitiatorId,
                "username": dictInitiator.get("name", ""),
                "role": "initiator",
                "email": dictInitiator.get("email", ""),
                "current_status": "SUBMITTED",
                "receivedAt": None,
                "submittedAt": dtNow.isoformat(),
                "bIsReApply": False
            }
        ]
        
        # Add reviewers from chain
        for idx, dictReviewer in enumerate(lsChain):
            strReviewerId = dictReviewer["user_id"]
            dictReviewerUser = objUsers.find_one({"_id": ObjectId(strReviewerId)})
            
            if not dictReviewerUser:
                objLogger.warning(f"⚠️ Reviewer not found: {strReviewerId}")
                continue
            
            # Determine role from user's departments
            strRole = "manager"  # Default
            for dept in dictReviewerUser.get("departments", []):
                if dept.get("role") == "owner":
                    strRole = "owner"
                    break
                elif dept.get("role") == "ca":
                    strRole = "ca"
                    break
                elif dept.get("role") == "senior_manager":
                    strRole = "senior_manager"

            if dictReviewerUser.get("departments"):
                strDepartment = dictReviewerUser.get("departments")[0]["department_name"]
            
            lsEnhancedChain.append({
                "step": idx + 1,
                "user_id": strReviewerId,
                "username": dictReviewerUser.get("name", ""),
                "email": dictReviewerUser.get("email",""),
                "department": strDepartment,
                "role": strRole,
                "current_status": "PENDING",
                "receivedAt": None,
                "submittedAt": None,
                "bIsReApply": False  # Not applicable for reviewers
            })
        
        objLogger.info(f"✅ Created approval chain with {len(lsEnhancedChain)} steps")
        return lsEnhancedChain

    except Exception as objErr:
        objLogger.error(f"❌ Error creating embedded approval chain: {str(objErr)}")
        raise Exception(f"Failed to create approval chain: {str(objErr)}")


def updateApprovalChainStep(strReimbursementId: str, iStep: int, dictUpdates: Dict) -> None:
    """
    Purpose : Update a specific step in the embedded approval chain.
              Uses MongoDB array element update notation.

    Inputs  :   (1) strReimbursementId : Reimbursement ID (str)
                (2) iStep              : Step index to update (int)
                (3) dictUpdates        : Fields to update in the step (dict)

    Output  : None (updates document in place)

    Example : updateApprovalChainStep("reimb123", 1, {
                  "current_status": "IN_REVIEW",
                  "receivedAt": "2026-06-10T14:30:00Z"
              })

    Notes   : - Uses positional operator to update specific array element
              - Automatically sets updated_at timestamp
    """
    try:
        objLogger.info(f"📝 UPDATING APPROVAL CHAIN STEP | reimb: {strReimbursementId} | step: {iStep}")

        objReimbs = get_collection("reimbursements")

        # Build update query for specific array element
        dictUpdateFields = {}
        for strKey, objValue in dictUpdates.items():
            dictUpdateFields[f"approval_chain.{iStep}.{strKey}"] = objValue

        dictUpdateFields["updated_at"] = getCurrentIst().isoformat()

        objResult = objReimbs.update_one(
            {"_id": ObjectId(strReimbursementId)},
            {"$set": dictUpdateFields}
        )

        if objResult.modified_count > 0:
            objLogger.info(f"✅ Updated approval chain step {iStep}")
        else:
            objLogger.warning(f"⚠️ No document modified for step update")

    except Exception as objErr:
        objLogger.error(f"❌ Error updating approval chain step: {str(objErr)}")
        raise Exception(f"Failed to update approval chain step: {str(objErr)}")


def markStepAsViewed(strReimbursementId: str, iStep: int) -> None:
    """
    Purpose : Mark a step as viewed (sets receivedAt and changes status from PENDING to IN_REVIEW)
              Called when reviewer opens reimbursement detail page.

    Inputs  :   (1) strReimbursementId : Reimbursement ID (str)
                (2) iStep              : Step index (int)

    Output  : None

    Example : markStepAsViewed("reimb123", 1)

    Notes   : - Only updates if current_status is PENDING and receivedAt is not set
              - This tracks when reviewer first opened the reimbursement
    """
    try:
        objLogger.info(f"👁️ MARKING STEP AS VIEWED | reimb: {strReimbursementId} | step: {iStep}")

        objReimbs = get_collection("reimbursements")

        # Get current reimbursement
        dictReimb = objReimbs.find_one({"_id": ObjectId(strReimbursementId)})
        if not dictReimb:
            objLogger.error(f"❌ Reimbursement not found: {strReimbursementId}")
            return

        lsChain = dictReimb.get("approval_chain", [])
        if iStep >= len(lsChain):
            objLogger.error(f"❌ Invalid step index: {iStep}")
            return

        dictStep = lsChain[iStep]

        # Only update if status is PENDING and receivedAt is not set
        if dictStep.get("current_status") == "PENDING" and not dictStep.get("receivedAt"):
            updateApprovalChainStep(strReimbursementId, iStep, {
                "current_status": "IN_REVIEW",
                "receivedAt": getCurrentIst().isoformat()
            })
            objLogger.info(f"✅ Marked step {iStep} as viewed")
        else:
            objLogger.info(f"ℹ️ Step {iStep} already viewed or not pending")

    except Exception as objErr:
        objLogger.error(f"❌ Error marking step as viewed: {str(objErr)}")


def markInitiatorReapply(strReimbursementId: str) -> None:
    """
    Purpose : Mark initiator step (step 0) as reapplied.
              Sets bIsReApply to True when initiator responds to QUERY or ASK.

    Inputs  :   (1) strReimbursementId : Reimbursement ID (str)

    Output  : None

    Example : markInitiatorReapply("reimb123")

    Notes   : - bIsReApply is only for initiator (step 0)
              - Tracks whether this is a resubmission after query/ask
    """
    try:
        objLogger.info(f"🔄 MARKING INITIATOR AS REAPPLY | reimb: {strReimbursementId}")

        updateApprovalChainStep(strReimbursementId, 0, {
            "bIsReApply": True,
            "current_status": "REAPPLIED",
            "submittedAt": getCurrentIst().isoformat()
        })

        objLogger.info(f"✅ Marked initiator as reapplied")

    except Exception as objErr:
        objLogger.error(f"❌ Error marking initiator reapply: {str(objErr)}")
