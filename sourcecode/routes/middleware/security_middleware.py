'''
Purpose : Production-hardening middleware stack —
          (1) RateLimitMiddleware     — sliding-window per-IP throttle (in-memory).
          (2) SecurityHeadersMiddleware — adds standard hardening response headers.
          (3) RequestLoggerMiddleware — structured access log (method, path, status, ms).
          (4) installGlobalExceptionHandler — converts uncaught errors into safe JSON 500.

Inputs  : FastAPI app instance for installation; HTTP requests at runtime.

Output  : Modified responses (extra headers, possible 429/500); log records.

Dependencies: fastapi, starlette, env_config
'''

import logging
import time
import traceback
from collections import deque
from threading import Lock
from typing import Deque, Dict, Tuple

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

from env_config import objSettings


objLogger = logging.getLogger(__name__)


# ──────────────────────────────────────────────────────────────────────────────
# 1) Rate limiter — sliding window, per (client IP, bucket)
# ──────────────────────────────────────────────────────────────────────────────
class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Purpose : Reject excessive requests with 429.
              Two buckets:
                - "auth"    : 10 req / 60 s on /api/auth/login & /api/auth/signup.
                - "general" : 300 req / 60 s on everything else.

    Inputs  : ASGI app instance.

    Output  : 429 JSON when limit exceeded, otherwise downstream response.

    Example : objApp.add_middleware(RateLimitMiddleware)
    """

    _BUCKETS: Dict[Tuple[str, str], Deque[float]] = {}
    _LOCK = Lock()
    _LIMITS = {"auth": (10, 60.0), "general": (300, 60.0)}

    def __init__(self, app: ASGIApp) -> None:
        super().__init__(app)

    def _classify(self, strPath: str) -> str:
        if strPath.startswith("/api/auth/login") or strPath.startswith("/api/auth/signup"):
            return "auth"
        return "general"

    def _isAllowed(self, strKey: Tuple[str, str], numLimit: int, numWindow: float) -> bool:
        fNow = time.monotonic()
        with self._LOCK:
            objQueue = self._BUCKETS.setdefault(strKey, deque())
            while objQueue and (fNow - objQueue[0]) > numWindow:
                objQueue.popleft()
            if len(objQueue) >= numLimit:
                return False
            objQueue.append(fNow)
            return True

    async def dispatch(self, request: Request, call_next):
        strPath = request.url.path
        # Skip health checks so monitoring doesn't get throttled
        if strPath == "/api/health":
            return await call_next(request)
        strBucket = self._classify(strPath)
        numLimit, numWindow = self._LIMITS[strBucket]
        strClient = request.client.host if request.client else "unknown"
        if not self._isAllowed((strClient, strBucket), numLimit, numWindow):
            objLogger.warning(f"🚫 RATE LIMIT  {strClient} {request.method} {strPath} ({strBucket})")
            return JSONResponse(
                status_code=429,
                content={"success": False, "detail": "Too many requests. Please slow down."},
                headers={"Retry-After": "60"},
            )
        return await call_next(request)


# ──────────────────────────────────────────────────────────────────────────────
# 2) Security headers
# ──────────────────────────────────────────────────────────────────────────────
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Purpose : Append standard hardening headers to every response.

    Inputs  : ASGI app instance.

    Output  : Response with X-Content-Type-Options, X-Frame-Options,
              Referrer-Policy, Permissions-Policy, and (in prod) HSTS.

    Example : objApp.add_middleware(SecurityHeadersMiddleware)
    """

    async def dispatch(self, request: Request, call_next):
        objResponse = await call_next(request)
        objResponse.headers["X-Content-Type-Options"] = "nosniff"
        objResponse.headers["X-Frame-Options"] = "DENY"
        objResponse.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        objResponse.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        if objSettings.APP_ENV.lower() == "production":
            objResponse.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains"
        return objResponse


# ──────────────────────────────────────────────────────────────────────────────
# 3) Request logger
# ──────────────────────────────────────────────────────────────────────────────
class RequestLoggerMiddleware(BaseHTTPMiddleware):
    """
    Purpose : Emit one structured INFO line per HTTP request (excluding /api/health).

    Inputs  : ASGI app instance.

    Output  : Log line: "📡 METHOD PATH → STATUS in XXX ms (client=IP)".

    Example : objApp.add_middleware(RequestLoggerMiddleware)
    """

    async def dispatch(self, request: Request, call_next):
        if request.url.path == "/api/health":
            return await call_next(request)
        fStart = time.perf_counter()
        objResponse = await call_next(request)
        fElapsedMs = (time.perf_counter() - fStart) * 1000.0
        strClient = request.client.host if request.client else "unknown"
        objLogger.info(
            f"📡 {request.method:<6} {request.url.path} → {objResponse.status_code} "
            f"in {fElapsedMs:6.1f} ms (client={strClient})"
        )
        return objResponse


# ──────────────────────────────────────────────────────────────────────────────
# 4) Global exception handler — install on FastAPI app
# ──────────────────────────────────────────────────────────────────────────────
def installGlobalExceptionHandler(objApp: FastAPI) -> None:
    """
    Purpose : Catch every uncaught Python exception, log full stack, return a
              generic 500 JSON instead of leaking tracebacks.

    Inputs  :   (1) objApp : FastAPI application instance.

    Output  : None (registers handler in-place).

    Example : installGlobalExceptionHandler(objApp)
    """

    @objApp.exception_handler(Exception)
    async def _handleUncaught(request: Request, objErr: Exception):
        objLogger.error(
            f"💥 UNHANDLED  {request.method} {request.url.path} :: {type(objErr).__name__}: {objErr}\n"
            f"{traceback.format_exc()}"
        )
        return JSONResponse(
            status_code=500,
            content={"success": False, "detail": "An unexpected server error occurred."},
        )
