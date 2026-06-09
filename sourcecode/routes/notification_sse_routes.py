'''
Purpose : Server-Sent Events (SSE) endpoint for real-time notification updates.
          Streams notification count changes to connected clients.

Inputs  : HTTP GET request with JWT token as query parameter.

Output  : text/event-stream with notification update events.

Dependencies: fastapi, asyncio, mongodb_config, jwt_middleware
'''

import logging
import asyncio
import json
from typing import AsyncGenerator
from fastapi import APIRouter, Request, Query, HTTPException
from fastapi.responses import StreamingResponse
from datetime import datetime, timezone

from config.mongodb_config import get_collection
from middleware.jwt_middleware import _decodeToken

objLogger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/notifications", tags=["Notifications SSE"])

# SSE check interval in seconds
SSE_CHECK_INTERVAL = 5

def get_unread_count(strUserId: str) -> int:
    """
    Purpose : Get unread notification count for a user.
    
    Inputs  :   (1) strUserId : User ID (str)
    
    Output  : Count of unread notifications (int)
    
    Example : count = await get_unread_count("user123")
              # Returns: 5
    """
    try:
        objNotifs = get_collection("notifications")
        iCount = objNotifs.count_documents({
            "user_id": strUserId,
            "is_read": False,
        })
        return iCount
    except Exception as objErr:
        objLogger.error(f"❌ Error getting unread count: {objErr}")
        return 0


async def notification_event_generator(
    objRequest: Request,
    strUserId: str
) -> AsyncGenerator[str, None]:
    """
    Purpose : Generate SSE events for notification updates.
              Checks for unread count changes every 5 seconds and pushes events.
    
    Inputs  :   (1) objRequest : FastAPI Request object (Request)
                (2) strUserId  : User ID (str)
    
    Output  : Yields SSE formatted event strings
    
    Example : async for event in notification_event_generator(request, "user123"):
                  # Yields: "data: {\"event_type\": \"count_update\", ...}\n\n"
    """
    intPreviousCount = -1  # Initialize to -1 to always send first update
    
    try:
        while True:
            # Check if client disconnected
            if await objRequest.is_disconnected():
                objLogger.info(f"📤 SSE client disconnected | user_id={strUserId}")
                break
            
            try:
                # Get current unread count
                # intCurrentCount = await get_unread_count(strUserId)
                intCurrentCount = await asyncio.to_thread(get_unread_count, strUserId)
                
                # Only send event if count changed
                if intCurrentCount != intPreviousCount:
                    dictEvent = {
                        "event_type": "count_update",
                        "unread_count": intCurrentCount,
                        "has_new": intCurrentCount > intPreviousCount and intPreviousCount >= 0,
                        "timestamp": datetime.now(timezone.utc).isoformat()
                    }
                    
                    # Format as SSE event
                    strData = json.dumps(dictEvent)
                    yield f"data: {strData}\n\n"
                    
                    objLogger.info(f"📨 SSE event sent | user_id={strUserId} | count={intCurrentCount} | has_new={dictEvent['has_new']}")
                    
                    intPreviousCount = intCurrentCount
                
                # Wait before next check
                await asyncio.sleep(SSE_CHECK_INTERVAL)
            
            except asyncio.CancelledError:
                # Re-raise to outer handler (normal disconnection)
                raise
                
            except Exception as objErr:
                objLogger.error(f"❌ SSE generator error: {objErr}")
                # Send error event to client
                yield f"data: {{\"event_type\": \"error\", \"message\": \"Error checking notifications\"}}\n\n"
                await asyncio.sleep(SSE_CHECK_INTERVAL)
    
    except asyncio.CancelledError:
        # Normal disconnection - log and exit gracefully
        objLogger.info(f"✅ SSE stream closed | user_id={strUserId}")
        pass
    except GeneratorExit:
        # Generator was closed
        objLogger.info(f"✅ SSE generator exited | user_id={strUserId}")
        pass

@router.get("/stream")
async def notification_stream(
    objRequest: Request,
    token: str = Query(..., description="JWT authentication token")
):
    """
    Purpose : SSE endpoint for real-time notification updates.
              EventSource API cannot send Authorization headers, so token is passed as query parameter.
    
    Inputs  :   (1) objRequest : FastAPI Request object (Request)
                (2) token      : JWT token from query parameter (str)
    
    Output  : StreamingResponse with text/event-stream content type
    
    Example : GET /api/notifications/stream?token=<jwt_token>
              Response: text/event-stream
              data: {"event_type": "count_update", "unread_count": 5, "has_new": true}
    """
    try:
        objLogger.info(f"📥 SSE STREAM CONNECT REQUEST | token={token[:20]}...")
        
        # Validate JWT token from query parameter
        # EventSource cannot send custom headers, so we accept token as query param
        if not token:
            raise HTTPException(status_code=401, detail="JWT token required in query parameter")
        
        try:
            # Decode JWT token manually
            dictCurrentUser = _decodeToken(token)
            strUserId = str(dictCurrentUser.get("user_id", ""))
            
            if not strUserId:
                raise HTTPException(status_code=401, detail="User ID not found in token")
            
            objLogger.info(f"✅ SSE stream authenticated | user_id={strUserId}")
        
        except Exception as objErr:
            objLogger.error(f"❌ SSE authentication error: {objErr}")
            raise HTTPException(status_code=401, detail="Invalid or expired token")
        
        # Return SSE streaming response
        return StreamingResponse(
            notification_event_generator(objRequest, strUserId),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",  # Disable nginx buffering
                "Access-Control-Allow-Origin": "*",  # CORS for SSE
            }
        )
    
    except HTTPException:
        raise
    except Exception as objErr:
        objLogger.error(f"❌ SSE STREAM ERROR: {objErr}")
        raise HTTPException(status_code=500, detail=str(objErr))
