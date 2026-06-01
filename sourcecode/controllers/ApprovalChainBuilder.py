'''
Purpose : Build approval chain dynamically on reimbursement submission.
          Walks manager hierarchy, climbs to Owner, then to CA.

Inputs  : Initiator user_id, category_id (optional), department_id (optional).

Output  : Frozen chain snapshot (list of approver dicts).

Dependencies: config.mongodb_config
'''

import logging
from typing import List, Dict
from bson import ObjectId

from config.mongodb_config import get_collection

objLogger = logging.getLogger(__name__)


def buildChain(strInitiatorId: str, strCategoryId: str = None, strDepartmentId: str = None) -> List[Dict]:
    """
    Purpose : Build approval chain for a reimbursement.
              Walks managers by priority, climbs hierarchy until Owner, then adds CA.

    Inputs  :   (1) strInitiatorId   : User ID of the initiator (str)
                (2) strCategoryId    : Category ID (str, optional)
                (3) strDepartmentId  : Department ID (str, optional)

    Output  : List of chain step dicts (list of dict)

    Example : buildChain("user123") →
              [
                {"user_id": "mgr1", "name": "John", "priority": 1, "approval_type": "mandatory"},
                {"user_id": "mgr2", "name": "Jane", "priority": 2, "approval_type": "mandatory"},
                {"user_id": "owner1", "name": "Owner", "priority": 3, "approval_type": "mandatory"},
                {"user_id": "ca1", "name": "CA", "priority": 4, "approval_type": "mandatory"},
              ]
    """
    try:
        objUsers = get_collection("users")
        
        # Fetch initiator
        dictInitiator = objUsers.find_one({"_id": ObjectId(strInitiatorId)})
        if not dictInitiator:
            objLogger.error(f"❌ Initiator not found: {strInitiatorId}")
            return []
        
        lsChain = []
        setVisited = set()  # Prevent circular references
        setVisited.add(str(dictInitiator["_id"]))  # never add initiator to their own chain

        # Detect initiator role
        lsInitDepts = dictInitiator.get("departments", [])
        bInitiatorIsOwner = any(d.get("role") == "owner" for d in lsInitDepts)

        # Walk managers by priority
        lsManagers = dictInitiator.get("managers", [])

        # Rule: every non-Owner employee must have at least one manager.
        # If none configured, fall back to Owner as the manager.
        if not lsManagers and not bInitiatorIsOwner:
            dictOwnerFallback = objUsers.find_one({"departments.role": "owner", "is_active": True})
            if dictOwnerFallback:
                lsManagers = [{
                    "manager_id": str(dictOwnerFallback["_id"]),
                    "priority": 1,
                    "approval_type": "mandatory",
                }]

        lsManagers = sorted(lsManagers, key=lambda m: m.get("priority", 999))
        
        for dictMgr in lsManagers:
            strMgrId = str(dictMgr.get("manager_id", ""))
            if strMgrId in setVisited:
                continue
            setVisited.add(strMgrId)
            
            dictMgrUser = objUsers.find_one({"_id": ObjectId(strMgrId)})
            if not dictMgrUser:
                continue
            
            # Skip optional managers if needed (for now, include all)
            lsChain.append({
                "user_id": strMgrId,
                "name": dictMgrUser.get("name", ""),
                "email": dictMgrUser.get("email", ""),
                "priority": len(lsChain) + 1,
                "approval_type": dictMgr.get("approval_type", "mandatory"),
                "status": "PENDING",
            })
            
            # Recursively climb to manager's manager
            strCurrentId = strMgrId
            while True:
                dictCurrentUser = objUsers.find_one({"_id": ObjectId(strCurrentId)})
                if not dictCurrentUser:
                    break
                
                lsUpperManagers = dictCurrentUser.get("managers", [])
                if not lsUpperManagers:
                    break
                
                # Pick first manager (highest priority)
                dictNextMgr = sorted(lsUpperManagers, key=lambda m: m.get("priority", 999))[0]
                strNextMgrId = str(dictNextMgr.get("manager_id", ""))
                
                if strNextMgrId in setVisited:
                    break
                setVisited.add(strNextMgrId)
                
                dictNextMgrUser = objUsers.find_one({"_id": ObjectId(strNextMgrId)})
                if not dictNextMgrUser:
                    break
                
                # Check if this is owner
                lsDepts = dictNextMgrUser.get("departments", [])
                bIsOwner = any(d.get("role") == "owner" for d in lsDepts)
                
                lsChain.append({
                    "user_id": strNextMgrId,
                    "name": dictNextMgrUser.get("name", ""),
                    "email": dictNextMgrUser.get("email", ""),
                    "priority": len(lsChain) + 1,
                    "approval_type": dictNextMgr.get("approval_type", "mandatory"),
                    "status": "PENDING",
                })
                
                if bIsOwner:
                    break  # Owner is the top
                
                strCurrentId = strNextMgrId
        
        # Add Owner if not already in chain and initiator isn't the Owner.
        # (An Owner-initiator has no manager — only CA reviews their reimbursement.)
        if not bInitiatorIsOwner:
            dictOwner = objUsers.find_one({"departments.role": "owner", "is_active": True})
            if dictOwner:
                strOwnerId = str(dictOwner["_id"])
                if strOwnerId not in setVisited:
                    setVisited.add(strOwnerId)
                    lsChain.append({
                        "user_id": strOwnerId,
                        "name": dictOwner.get("name", ""),
                        "email": dictOwner.get("email", ""),
                        "priority": len(lsChain) + 1,
                        "approval_type": "mandatory",
                        "status": "PENDING",
                    })
        
        # Add CA (skip if CA is the initiator or already in chain)
        dictCA = objUsers.find_one({"departments.role": "ca", "is_active": True})
        if dictCA:
            strCAId = str(dictCA["_id"])
            if strCAId not in setVisited:
                setVisited.add(strCAId)
                lsChain.append({
                    "user_id": strCAId,
                    "name": dictCA.get("name", ""),
                    "email": dictCA.get("email", ""),
                    "priority": len(lsChain) + 1,
                    "approval_type": "mandatory",
                    "status": "PENDING",
                })
        
        objLogger.info(f"✅ CHAIN BUILT: {len(lsChain)} steps for initiator {strInitiatorId}")
        return lsChain
    
    except Exception as objErr:
        objLogger.error(f"❌ BUILD CHAIN ERROR: {objErr}")
        return []


def snapshotChain(lsObjChain: List[Dict]) -> List[Dict]:
    """
    Purpose : Serialize chain for frozen storage in reimbursement document.

    Inputs  :   (1) lsObjChain : List of chain step dicts (list of dict)

    Output  : Serialized chain snapshot (list of dict)

    Example : snapshotChain([...]) → [{"user_id": "...", "name": "...", ...}]
    """
    return [dict(objStep) for objStep in lsObjChain]
