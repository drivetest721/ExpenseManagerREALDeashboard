'''
Purpose : Production-ready Reimbursement Approval Chain Engine.
          Generates full approval tree with left-view chain extraction.
          Implements cycle detection, duplicate prevention, and enforces Owner→Accountant rule.

Inputs  : Initiator user_id
Output  : Complete approval tree + left-view chain snapshot

Dependencies: config.mongodb_config, logging
'''

import logging
from typing import List, Dict, Set, Optional, Tuple
from bson import ObjectId
from collections import deque

from config.mongodb_config import get_collection

objLogger = logging.getLogger(__name__)


class ApprovalTreeNode:
    """
    Represents a node in the approval tree.
    Each node can have multiple children (representing multiple managers).
    """
    def __init__(self, user_id: str, name: str, email: str, role: str, 
                 priority: int, approval_type: str, level: int):
        self.user_id = user_id
        self.name = name
        self.email = email
        self.role = role
        self.priority = priority
        self.approval_type = approval_type
        self.level = level
        self.children: List['ApprovalTreeNode'] = []
        self.status = "PENDING"
    
    def to_dict(self) -> Dict:
        """Convert node to dictionary representation."""
        return {
            "user_id": self.user_id,
            "name": self.name,
            "email": self.email,
            "role": self.role,
            "level": self.level,
            "priority": self.priority,
            "approval_type": self.approval_type,
            "status": self.status,
            "children": [child.to_dict() for child in self.children]
        }


class ApprovalChainEngine:
    """
    Production-ready approval chain engine.
    Builds complete tree, extracts left-view chain, detects cycles.

    What is Left-View Chain Explained?
    """
    
    def __init__(self):
        self.objUsers = get_collection("users")
        self.visited: Set[str] = set()
        self.path_stack: List[str] = []
    
    def _get_user_role(self, user_doc: Dict) -> str:
        """Extract primary role from user document."""
        departments = user_doc.get("departments", [])
        if not departments:
            return "employee"
        
        primary_dept = next((d for d in departments if d.get("is_primary")), departments[0])
        return primary_dept.get("role", "employee")
    
    def _is_owner(self, user_doc: Dict) -> bool:
        """Check if user is an Owner."""
        departments = user_doc.get("departments", [])
        return any(d.get("role") == "owner" for d in departments)
    
    def _is_accountant(self, user_doc: Dict) -> bool:
        """Check if user is Accountant/CA."""
        departments = user_doc.get("departments", [])
        return any(d.get("role") == "ca" for d in departments)
    
    def _build_tree_recursive(self, user_id: str, level: int) -> Optional[ApprovalTreeNode]:
        """
        Recursively build approval tree for a user.
        Returns the root node of the subtree.
        """
        # Cycle detection
        if user_id in self.path_stack:
            cycle_path = " -> ".join(self.path_stack + [user_id])
            raise ValueError(f"Cycle detected in approval chain: {cycle_path}")

        # Duplicate prevention - skip if already visited
        if user_id in self.visited:
            return None

        # Fetch user document
        try:
            user_doc = self.objUsers.find_one({"_id": ObjectId(user_id)})
        except Exception as e:
            objLogger.error(f"Invalid user_id format: {user_id} - {e}")
            return None

        if not user_doc or not user_doc.get("is_active", True):
            objLogger.warning(f"User {user_id} not found or inactive")
            return None

        # Mark as visited and add to path stack
        self.visited.add(user_id)
        self.path_stack.append(user_id)

        # Create node for current user
        user_role = self._get_user_role(user_doc)
        node = ApprovalTreeNode(
            user_id=user_id,
            name=user_doc.get("name", ""),
            email=user_doc.get("email", ""),
            role=user_role,
            priority=0,  # Will be set by parent
            approval_type="mandatory",
            level=level
        )

        # Get managers and sort by priority (lower number = higher priority)
        managers = user_doc.get("managers", [])
        managers_sorted = sorted(managers, key=lambda m: m.get("priority", 999))

        # Build child nodes for each manager
        # NOTE: Change This Logic to Only take Lowest Priority Manager Not List Of Mangers. This is because we want a single chain of approval not multiple parallel branches. The leftmost branch will be the one with the highest priority managers.
        for idx, mgr in enumerate(managers_sorted):
            mgr_id = str(mgr.get("manager_id", ""))
            if not mgr_id or mgr_id in self.visited:
                continue

            child_node = self._build_tree_recursive(mgr_id, level + 1)
            if child_node:
                child_node.priority = mgr.get("priority", idx + 1)
                child_node.approval_type = mgr.get("approval_type", "mandatory")
                node.children.append(child_node)

        # Remove from path stack (backtrack)
        self.path_stack.pop()

        return node

    def _extract_left_view(self, root: ApprovalTreeNode) -> List[Dict]:
        """
        Extract left-view chain from the tree.
        Left-view = leftmost path from root to leaf.
        """
        chain = []
        current = root

        while current:
            chain.append({
                "user_id": current.user_id,
                "name": current.name,
                "email": current.email,
                "role": current.role,
                "level": current.level,
                "priority": current.priority,
                "approval_type": current.approval_type,
                "status": "PENDING",
            })

            # Move to leftmost child (highest priority manager)
            if current.children:
                current = current.children[0]
            else:
                current = None

        return chain

    def _ensure_owner_before_accountant(self, chain: List[Dict]) -> List[Dict]:
        """
        Enforce Rule: Owner must always be before Accountant.
        Expected ending: ... -> Owner -> Accountant
        """
        # Find Owner and Accountant in chain
        owner_idx = None
        accountant_idx = None

        for idx, node in enumerate(chain):
            if node["role"] == "owner":
                owner_idx = idx
            if node["role"] == "ca":
                accountant_idx = idx

        # If both exist and accountant comes before owner, this is invalid
        if owner_idx is not None and accountant_idx is not None:
            if accountant_idx < owner_idx:
                raise ValueError(
                    "Invalid approval chain: Accountant cannot appear before Owner. "
                    "Expected: ... -> Owner -> Accountant"
                )

        return chain

    def _append_owner_and_accountant(self, chain: List[Dict], initiator_id: str) -> List[Dict]:
        """
        Ensure Owner and Accountant are at the end of the chain.
        Rule: Every reimbursement must pass through Owner -> Accountant.
        """
        # Check if initiator is Owner
        try:
            initiator_doc = self.objUsers.find_one({"_id": ObjectId(initiator_id)})
            initiator_is_owner = self._is_owner(initiator_doc) if initiator_doc else False
        except:
            initiator_is_owner = False

        # Extract user_ids already in chain
        chain_user_ids = {node["user_id"] for node in chain}

        # Add Owner if not already in chain and initiator is not Owner
        if not initiator_is_owner:
            owner_in_chain = any(node["role"] == "owner" for node in chain)
            if not owner_in_chain:
                # Find first active Owner
                owner_doc = self.objUsers.find_one({"departments.role": "owner", "is_active": True})
                if owner_doc:
                    owner_id = str(owner_doc["_id"])
                    if owner_id not in chain_user_ids:
                        chain.append({
                            "user_id": owner_id,
                            "name": owner_doc.get("name", ""),
                            "email": owner_doc.get("email", ""),
                            "role": "owner",
                            "level": len(chain) + 1,
                            "priority": len(chain) + 1,
                            "approval_type": "mandatory",
                            "status": "PENDING",
                        })
                        chain_user_ids.add(owner_id)

        # Add Accountant (always at the end)
        accountant_in_chain = any(node["role"] == "ca" for node in chain)
        if not accountant_in_chain:
            # Find first active Accountant
            ca_doc = self.objUsers.find_one({"departments.role": "ca", "is_active": True})
            if ca_doc:
                ca_id = str(ca_doc["_id"])
                if ca_id not in chain_user_ids:
                    chain.append({
                        "user_id": ca_id,
                        "name": ca_doc.get("name", ""),
                        "email": ca_doc.get("email", ""),
                        "role": "ca",
                        "level": len(chain) + 1,
                        "priority": len(chain) + 1,
                        "approval_type": "mandatory",
                        "status": "PENDING",
                    })

        return chain

    def build_approval_chain(self, initiator_id: str) -> Tuple[Dict, List[Dict]]:
        """
        Main entry point: Build complete approval tree and extract left-view chain.

        Inputs:
            initiator_id: User ID of the reimbursement initiator

        Returns:
            Tuple of (full_tree_dict, left_view_chain_list)

        Raises:
            ValueError: If cycle detected or invalid hierarchy
        """
        # Reset state
        self.visited = set()
        self.path_stack = []

        # Mark initiator as visited (initiator never appears in their own chain)
        self.visited.add(initiator_id)

        try:
            # Fetch initiator
            initiator_doc = self.objUsers.find_one({"_id": ObjectId(initiator_id)})
            if not initiator_doc:
                raise ValueError(f"Initiator not found: {initiator_id}")

            # Check if initiator is Owner
            initiator_is_owner = self._is_owner(initiator_doc)

            # Get initiator's managers
            managers = initiator_doc.get("managers", [])

            # Special case: If initiator has no managers and is not Owner, add Owner as fallback
            if not managers and not initiator_is_owner:
                owner_doc = self.objUsers.find_one({"departments.role": "owner", "is_active": True})
                if owner_doc:
                    managers = [{
                        "manager_id": str(owner_doc["_id"]),
                        "priority": 1,
                        "approval_type": "mandatory",
                    }]

            # Build tree with initiator as implicit root
            root_children = []
            #NOTE - Change This Logic to Only take Lowest Priority Manager Not List Of Mangers. This is because we want a single chain of approval not multiple parallel branches. The leftmost branch will be the one with the highest priority managers.
            managers_sorted = sorted(managers, key=lambda m: m.get("priority", 999))

            for idx, mgr in enumerate(managers_sorted):
                mgr_id = str(mgr.get("manager_id", ""))
                if not mgr_id:
                    continue

                child_node = self._build_tree_recursive(mgr_id, level=1)
                if child_node:
                    child_node.priority = mgr.get("priority", idx + 1)
                    child_node.approval_type = mgr.get("approval_type", "mandatory")
                    root_children.append(child_node)

            # Build tree dict
            tree = {
                "initiator_id": initiator_id,
                "initiator_name": initiator_doc.get("name", ""),
                "branches": [child.to_dict() for child in root_children]
            }

            # Extract left-view chain (leftmost branch)
            chain = []
            if root_children:
                chain = self._extract_left_view(root_children[0])

            # Ensure Owner -> Accountant rule
            chain = self._append_owner_and_accountant(chain, initiator_id)
            chain = self._ensure_owner_before_accountant(chain)

            # Re-number levels sequentially
            for idx, node in enumerate(chain):
                node["level"] = idx + 1

            objLogger.info(
                f"✅ APPROVAL CHAIN BUILT: {len(chain)} reviewers for initiator {initiator_id}"
            )

            return tree, chain

        except Exception as e:
            objLogger.error(f"❌ APPROVAL CHAIN BUILD ERROR: {e}")
            raise


def build_approval_chain_for_reimbursement(initiator_id: str) -> Tuple[Dict, List[Dict]]:
    """
    Public function: Build approval chain for a reimbursement submission.

    Inputs:
        initiator_id: User ID of the initiator

    Returns:
        Tuple of (full_tree, left_view_chain)

    Usage:
        tree, chain = build_approval_chain_for_reimbursement("user123")
    """
    engine = ApprovalChainEngine()
    return engine.build_approval_chain(initiator_id)

