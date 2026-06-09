# SSE (Server-Sent Events) Notification System Implementation

## Overview

This document explains the Server-Sent Events (SSE) implementation for real-time notifications in the Drake AI App. SSE enables the server to push updates to the client without the client needing to poll repeatedly.

---

## Table of Contents

1. [What is SSE?](#what-is-sse)
2. [Architecture](#architecture)
3. [Backend Implementation](#backend-implementation)
4. [Frontend Implementation](#frontend-implementation)
5. [Issues Faced & Solutions](#issues-faced--solutions)
6. [API Reference](#api-reference)

---

## What is SSE?

Server-Sent Events (SSE) is a server push technology that allows a server to send real-time updates to a client over a single HTTP connection. Unlike WebSockets, SSE is:

- **Unidirectional**: Server → Client only
- **HTTP-based**: Works over standard HTTP/HTTPS
- **Auto-reconnecting**: Browser automatically reconnects if connection drops
- **Simple**: No special protocol, just text/event-stream content type

### Why SSE for Notifications?

| Feature | SSE | WebSocket | Polling |
|---------|-----|-----------|---------|
| Real-time updates | ✅ | ✅ | ❌ |
| Server → Client | ✅ | ✅ | ✅ |
| Client → Server | ❌ | ✅ | ✅ |
| Auto-reconnect | ✅ | ❌ | N/A |
| Simpler setup | ✅ | ❌ | ✅ |
| Lower overhead | ✅ | ✅ | ❌ |

For notifications (which only need server→client), SSE is the optimal choice.

---

## Architecture

```
┌─────────────────┐                    ┌─────────────────────┐
│   Frontend      │                    │      Backend        │
│                 │                    │                     │
│  EventSource ──────── SSE Stream ──────► SSE Endpoint     │
│  (JavaScript)   │    (text/event-    │   /stream           │
│                 │     stream)        │                     │
│  onmessage() ◄──────── JSON Data ◄────── Event Generator  │
│                 │                    │                     │
│  Update UI      │                    │  MongoDB Query      │
│  Play Sound     │                    │  (Notifications)    │
└─────────────────┘                    └─────────────────────┘
```

### Data Flow

1. **Client connects** to `/api/v2/notifications/stream?token=<jwt>`
2. **Server validates** JWT token from query parameter
3. **Server starts** async generator loop
4. **Every 5 seconds**, server checks unread notification count
5. **If count changed**, server sends SSE event with new count
6. **Client receives** event and updates UI (badge, sound)
7. **Connection persists** until client disconnects

---

## Backend Implementation

### File: `sourcecode/routes/notification_sse_routes.py`

#### SSE Endpoint Definition

```python
@router.get("/stream")
async def funcNotificationStream(
    request: Request,
    token: str = None  # Token passed as query parameter
):
    """
    SSE endpoint for real-time notification updates.
    
    EventSource (browser API) cannot send Authorization headers,
    so JWT token is passed as a query parameter instead.
    """
    from middleware.jwt_middleware import JWTMiddleware
    
    # Validate token
    if not token:
        raise HTTPException(status_code=401, detail="Token required")
    
    # Decode JWT manually (not using Depends)
    dictCurrentUser = JWTMiddleware.decode_access_token(token)
    strUserId = str(dictCurrentUser.get("user_id", ""))
    
    # Return streaming response
    return StreamingResponse(
        funcNotificationEventGenerator(request, strUserId),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable nginx buffering
        }
    )
```

#### Event Generator (Async Generator)

```python
async def funcNotificationEventGenerator(
    request: Request,
    strUserId: str
) -> AsyncGenerator[str, None]:
    """Generate SSE events for notification updates"""
    intPreviousCount = -1  # Initialize to -1 to always send first update
    
    try:
        while True:
            # Check if client disconnected
            if await request.is_disconnected():
                break
            
            try:
                # Get current unread count from MongoDB
                intCurrentCount = await objNotificationService.funcGetUnreadCount(strUserId)
                
                # Only send event if count changed
                if intCurrentCount != intPreviousCount:
                    dictEvent = {
                        "event_type": "count_update",
                        "unreadCount": intCurrentCount,
                        "hasNew": intCurrentCount > intPreviousCount and intPreviousCount >= 0
                    }
                    
                    # Format as SSE event
                    strData = json.dumps(dictEvent)
                    yield f"data: {strData}\n\n"
                    
                    intPreviousCount = intCurrentCount
                
                # Wait before next check
                await asyncio.sleep(SSE_CHECK_INTERVAL)  # 5 seconds
            
            except asyncio.CancelledError:
                raise  # Re-raise to outer handler
                
            except Exception as e:
                # Send error event
                yield f"data: {json.dumps({'event_type': 'error', 'message': str(e)})}\n\n"
                await asyncio.sleep(SSE_CHECK_INTERVAL)
    
    except asyncio.CancelledError:
        # Normal disconnection - log and exit gracefully
        pass
    except GeneratorExit:
        # Generator was closed
        pass
```

#### Router Registration Order (Critical!)

In `main.py`, the SSE router must be registered **BEFORE** the notification V2 router:

```python
# IMPORTANT: SSE router must be registered BEFORE V2 router because V2 has 
# /{strNotificationId} catch-all path that would match /stream if registered first
objApp.include_router(objNotificationSSERouter)
objApp.include_router(objNotificationV2Router)
```

---

## Frontend Implementation

### File: `client/src/services/notificationService.ts`

#### SSE Connection

```typescript
let objEventSource: EventSource | null = null;

export const funcConnectSSE = (
  funcOnUpdate: (data: ISSECountUpdate) => void
): void => {
  // Get JWT token from storage
  const strToken = localStorage.getItem('authToken');
  if (!strToken) return;

  // Build SSE URL with token as query parameter
  const strUrl = buildUrl(`/api/v2/notifications/stream?token=${strToken}`);
  
  // Create EventSource connection
  objEventSource = new EventSource(strUrl);
  
  // Handle incoming messages
  objEventSource.onmessage = (event) => {
    const objData = JSON.parse(event.data);
    funcOnUpdate(objData);
  };
  
  // Handle errors (will auto-reconnect)
  objEventSource.onerror = (error) => {
    console.error('[SSE] Connection error:', error);
  };
};

export const funcDisconnectSSE = (): void => {
  if (objEventSource) {
    objEventSource.close();
    objEventSource = null;
  }
};
```

### File: `client/src/pages/NotificationsPage.tsx`

#### Using SSE in Component

```typescript
useEffect(() => {
  // Connect to SSE for real-time updates
  funcConnectSSE((objEvent: ISSECountUpdate) => {
    if (objEvent.event_type === 'count_update') {
      setIntUnreadCount(objEvent.unreadCount);
      
      // Play notification sound if new notification arrived
      if (objEvent.hasNew && bSoundEnabled) {
        funcPlayNotificationChime();
      }
      
      // Refresh notification list
      funcRefreshNotifications();
    }
  });
  
  // Cleanup on unmount
  return () => {
    funcDisconnectSSE();
  };
}, []);
```

---

## Issues Faced & Solutions

### Issue 1: 403 Forbidden Error on SSE Endpoint

**Problem**: SSE endpoint was returning 403 Forbidden error.

**Root Cause**: The endpoint was using `Depends(get_current_user_dependency)` which requires an `Authorization` header. However, the browser's `EventSource` API **cannot send custom headers**.

**Solution**: Changed endpoint to accept JWT token as a **query parameter** instead:

```python
# BEFORE (broken)
@router.get("/stream")
async def funcNotificationStream(
    dictCurrentUser: dict = Depends(get_current_user_dependency)  # ❌ Requires header
):

# AFTER (working)
@router.get("/stream")
async def funcNotificationStream(
    request: Request,
    token: str = None  # ✅ Passed as query parameter
):
    dictCurrentUser = JWTMiddleware.decode_access_token(token)
```

---

### Issue 2: JWT Token Signature Verification Failed

**Problem**: Even after passing token as query parameter, still getting 403.

**Root Cause**: `jwt_middleware.py` wasn't loading the `.env` file, so it was using the default fallback secret key instead of the actual secret.

**Solution**: Added explicit `.env` loading in `jwt_middleware.py`:

```python
from dotenv import load_dotenv
from pathlib import Path

# Load .env with multiple fallback paths
_possible_paths = [
    Path(__file__).parent.parent.parent / '.env',
    Path(__file__).parent.parent / '.env',
    Path.cwd() / '.env',
]
for _env_path in _possible_paths:
    if _env_path.exists():
        load_dotenv(_env_path)
        break
```

---

### Issue 3: Route Matching - /stream Caught by /{strNotificationId}

**Problem**: Requests to `/api/v2/notifications/stream` were returning 403 before reaching the SSE endpoint function.

**Root Cause**: Both `notification_routes_v2.py` and `notification_sse_routes.py` use the same prefix `/api/v2/notifications`. The V2 router has a catch-all route `/{strNotificationId}` which was matching "stream" as a notification ID before FastAPI could check the SSE router's specific `/stream` route.

**Solution**: Register the SSE router **BEFORE** the V2 router in `main.py`:

```python
# main.py - Router registration order matters!

# ✅ CORRECT ORDER
objApp.include_router(objNotificationSSERouter)  # First - specific /stream route
objApp.include_router(objNotificationV2Router)   # Second - has /{strNotificationId}

# ❌ WRONG ORDER (caused 403)
objApp.include_router(objNotificationV2Router)   # /{strNotificationId} matches "stream"
objApp.include_router(objNotificationSSERouter)  # Never reached
```

---

### Issue 4: CancelledError Exception on Client Disconnect

**Problem**: When client disconnects from SSE stream, server throws `asyncio.CancelledError` exception.

**Root Cause**: The inner `except Exception` block was catching `CancelledError` and trying to send an error event and sleep again, causing another `CancelledError`.

**Solution**: Explicitly catch and re-raise `CancelledError` before the generic `Exception` handler:

```python
try:
    # ... notification check logic ...
    await asyncio.sleep(SSE_CHECK_INTERVAL)

except asyncio.CancelledError:
    raise  # ✅ Re-raise to outer handler (don't catch as error)
    
except Exception as e:
    # Handle other errors
    yield f"data: {json.dumps({'event_type': 'error'})}\n\n"
```

---

### Issue 5: NotificationStatus Case Mismatch (Blue Dots Always Showing)

**Problem**: Blue dots (unread indicators) were showing for all notifications, even read ones.

**Root Cause**: Backend returned `"Read"` / `"Unread"` (capitalized), but frontend compared with `'read'` (lowercase).

**Solution**: Convert status to frontend-expected format in backend serialization:

```python
# Backend: Convert to lowercase
strBackendStatus = dictUserStatus["NotificationStatus"]  # "Read" or "Unread"
strFrontendStatus = "read" if strBackendStatus == "Read" else "sent"

dictResult["NotificationStatus"] = strFrontendStatus
```

---

### Issue 6: HTML in Notification Body

**Problem**: Notification body displayed raw HTML instead of readable text.

**Root Cause**: `Description` field contains full HTML email content.

**Solution**: Added HTML stripping helper function:

```python
def _funcStripHtmlToText(self, strHtml: str) -> str:
    """Strip HTML tags and extract plain text summary"""
    import re
    
    # Remove style/script tags
    strText = re.sub(r'<style[^>]*>.*?</style>', '', strHtml, flags=re.DOTALL)
    strText = re.sub(r'<script[^>]*>.*?</script>', '', strText, flags=re.DOTALL)
    
    # Convert block elements to newlines
    strText = re.sub(r'<br\s*/?>', '\n', strText)
    strText = re.sub(r'</p>', '\n', strText)
    
    # Remove all remaining HTML tags
    strText = re.sub(r'<[^>]+>', '', strText)
    
    # Clean up and return first 500 chars
    strText = re.sub(r'\s+', ' ', strText).strip()
    return strText[:500] + "..." if len(strText) > 500 else strText
```

---

## API Reference

### SSE Endpoint

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v2/notifications/stream` | GET | SSE stream for notification updates |
| `/api/v2/notifications/stream-v2` | GET | Alternative SSE using sse-starlette library |

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `token` | string | Yes | JWT authentication token |

### SSE Event Format

```json
{
  "event_type": "count_update",
  "unreadCount": 5,
  "hasNew": true
}
```

### Event Types

| Event Type | Description |
|------------|-------------|
| `count_update` | Unread count has changed |
| `error` | An error occurred |

---

## Configuration

### Server Settings

| Setting | Value | Location |
|---------|-------|----------|
| SSE Check Interval | 5 seconds | `notification_sse_routes.py` |
| JWT Secret | `.env` file | `JWT_SECRET_KEY` |
| Server Port | 8095 | `main.py` |

### Frontend Settings

| Setting | Value | Description |
|---------|-------|-------------|
| Sound Enabled | User preference | Stored in localStorage |
| Auto-reconnect | Browser default | EventSource handles automatically |

---

## Testing

### Using curl

```bash
# Test SSE endpoint
curl -N "http://localhost:8095/api/v2/notifications/stream?token=YOUR_JWT_TOKEN"

# Expected output (SSE format):
data: {"event_type": "count_update", "unreadCount": 3, "hasNew": false}

data: {"event_type": "count_update", "unreadCount": 4, "hasNew": true}
```

### Using PowerShell

```powershell
$token = "YOUR_JWT_TOKEN"
curl.exe -N "http://localhost:8095/api/v2/notifications/stream?token=$token"
```

---

## Files Modified

| File | Changes |
|------|---------|
| `sourcecode/routes/notification_sse_routes.py` | SSE endpoint implementation |
| `sourcecode/middleware/jwt_middleware.py` | Added .env loading |
| `sourcecode/services/notification_service.py` | HTML stripping, status formatting |
| `sourcecode/main.py` | Router registration order |
| `client/src/services/notificationService.ts` | SSE connection functions |
| `client/src/pages/NotificationsPage.tsx` | SSE integration |

---

## Summary

The SSE notification system provides real-time updates to the frontend without polling. Key lessons learned:

1. **EventSource cannot send headers** - use query parameters for authentication
2. **Router registration order matters** - specific routes before catch-all patterns
3. **CancelledError is expected** - handle gracefully on disconnect
4. **Field name/case consistency** - frontend and backend must agree on exact values
