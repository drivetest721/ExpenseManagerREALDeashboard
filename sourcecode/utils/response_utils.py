'''
Purpose : Standardised JSON response helpers for all FastAPI route handlers.
          Every endpoint MUST use these helpers to guarantee a consistent
          response envelope across the entire API.

Inputs  : Arbitrary data payloads and optional metadata.

Output  : Python dict ready to be returned from a FastAPI endpoint.

Dependencies: None (stdlib only)
'''

from typing import Any, Optional


def successResponse(
    strMessage: str,
    dictData: Optional[Any] = None,
    strKey: str = "data",
) -> dict:
    """
    Purpose : Build a standard success response envelope.

    Inputs  :   (1) strMessage : Human-readable success message (str).
                (2) dictData   : Payload to return (any JSON-serialisable type). Optional.
                (3) strKey     : Key name for the payload in the response (default "data").

    Output  : dict with keys: success, message, <strKey>.

    Example : return successResponse("User created", {"user_id": "abc123"})
              # {"success": True, "message": "User created", "data": {"user_id": "abc123"}}

              return successResponse("Items fetched", lsItems, strKey="items")
              # {"success": True, "message": "Items fetched", "items": [...]}
    """
    dictResponse: dict = {
        "success": True,
        "message": strMessage,
    }
    if dictData is not None:
        dictResponse[strKey] = dictData
    return dictResponse


def errorResponse(
    strMessage: str,
    iStatusCode: int = 400,
    dictDetails: Optional[Any] = None,
) -> dict:
    """
    Purpose : Build a standard error response envelope.
              Note: Prefer raising HTTPException directly in route handlers;
              use this helper only for non-HTTP internal error payloads.

    Inputs  :   (1) strMessage  : Human-readable error message (str).
                (2) iStatusCode : HTTP status code hint (int, default 400).
                (3) dictDetails : Optional extra details (any JSON-serialisable type).

    Output  : dict with keys: success, message, status_code[, details].

    Example : return errorResponse("Category not found", 404)
              # {"success": False, "message": "Category not found", "status_code": 404}
    """
    dictResponse: dict = {
        "success": False,
        "message": strMessage,
        "status_code": iStatusCode,
    }
    if dictDetails is not None:
        dictResponse["details"] = dictDetails
    return dictResponse


def paginatedResponse(
    strMessage: str,
    lsItems: list,
    iTotal: int,
    iPage: int = 1,
    iPageSize: int = 20,
) -> dict:
    """
    Purpose : Build a paginated list response envelope.

    Inputs  :   (1) strMessage : Human-readable message (str).
                (2) lsItems    : Page of items (list).
                (3) iTotal     : Total matching document count (int).
                (4) iPage      : Current page number (int, default 1).
                (5) iPageSize  : Page size used for this query (int, default 20).

    Output  : dict with success, message, items, total, page, page_size, has_next.

    Example : return paginatedResponse("Reimbursements fetched", lsReimbs, 55, 1, 20)
    """
    return {
        "success": True,
        "message": strMessage,
        "items": lsItems,
        "total": iTotal,
        "page": iPage,
        "page_size": iPageSize,
        "has_next": (iPage * iPageSize) < iTotal,
    }
