'''
Purpose : FastAPI application entry-point for the Expense Management backend.
          Wires CORS, logging, MongoDB index bootstrap, route includes, and
          a public health-check endpoint.

Inputs  : HTTP requests from the React (Vite) frontend.

Output  : JSON responses; raises HTTPException for error paths.

Dependencies: fastapi, uvicorn, env_config, config.mongodb_config
'''

import logging
import logging.handlers
import os
import sys
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from env_config import objSettings
from config.mongodb_config import ensure_indexes, ping_mongo
from middleware.security_middleware import (
    RateLimitMiddleware,
    SecurityHeadersMiddleware,
    RequestLoggerMiddleware,
    installGlobalExceptionHandler,
)


# ──────────────────────────────────────────────────────────────────────────────
# Logging setup (rotating file + console)
# ──────────────────────────────────────────────────────────────────────────────
strLogDir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "logs")
os.makedirs(strLogDir, exist_ok=True)
strLogFile = os.path.join(strLogDir, "expense_manager.log")

objLogFormatter = logging.Formatter(
    fmt="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)

objRootLogger = logging.getLogger()
objRootLogger.setLevel(logging.INFO)

objFileHandler = logging.handlers.RotatingFileHandler(
    strLogFile, maxBytes=5 * 1024 * 1024, backupCount=5, encoding="utf-8"
)
objFileHandler.setFormatter(objLogFormatter)

objStreamHandler = logging.StreamHandler()
objStreamHandler.setFormatter(objLogFormatter)

if not objRootLogger.handlers:
    objRootLogger.addHandler(objFileHandler)
    objRootLogger.addHandler(objStreamHandler)

objLogger = logging.getLogger(__name__)


# ──────────────────────────────────────────────────────────────────────────────
# Lifespan: startup/shutdown hooks
# ──────────────────────────────────────────────────────────────────────────────
_objScheduler = BackgroundScheduler(timezone="UTC")


@asynccontextmanager
async def lifespan(objApp: FastAPI):
    """
    Purpose : Run startup (Mongo ping + indexes + SLA scheduler) and shutdown tasks.

    Inputs  :   (1) objApp : FastAPI application instance

    Output  : None (async context manager)

    Example : passed to FastAPI(lifespan=lifespan)
    """
    objLogger.info(f"🚀 Starting {objSettings.APP_NAME} ({objSettings.APP_ENV})")
    try:
        ping_mongo()
        ensure_indexes()
    except Exception as objErr:
        objLogger.warning(f"⚠️  MongoDB not reachable at startup: {objErr}. App will start anyway.")

    # ── Start SLA background scheduler (hourly) ────────────────────────────────
    try:
        from controllers.SLAEngine import runSLACheck
        _objScheduler.add_job(
            runSLACheck,
            trigger=IntervalTrigger(hours=1),
            id="sla_check",
            name="SLA Hourly Check",
            replace_existing=True,
            misfire_grace_time=300,
        )
        _objScheduler.start()
        objLogger.info("⏰ SLA scheduler started (every 1 hour)")
    except Exception as objSchedErr:
        objLogger.warning(f"⚠️  SLA scheduler failed to start: {objSchedErr}")

    yield

    # ── Shutdown scheduler gracefully ──────────────────────────────────────────
    if _objScheduler.running:
        _objScheduler.shutdown(wait=False)
        objLogger.info("⏰ SLA scheduler stopped")
    objLogger.info("👋 Shutting down")


# ──────────────────────────────────────────────────────────────────────────────
# FastAPI app
# ──────────────────────────────────────────────────────────────────────────────
objApp = FastAPI(
    title=objSettings.APP_NAME,
    description="Expense Management — Reimbursement workflow for Real Dashboard App",
    version="0.1.0",
    lifespan=lifespan,
)

objApp.add_middleware(
    CORSMiddleware,
    allow_origins=objSettings.lsStrCorsOrigins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Hardening stack (added in reverse execution order — last added runs first).
# objApp.add_middleware(RateLimitMiddleware)
objApp.add_middleware(RequestLoggerMiddleware)
objApp.add_middleware(SecurityHeadersMiddleware)

# Catch-all exception → safe JSON 500
installGlobalExceptionHandler(objApp)


# ──────────────────────────────────────────────────────────────────────────────
# Health endpoint
# ──────────────────────────────────────────────────────────────────────────────
@objApp.get("/api/health", tags=["Health"])
async def health_check():
    """
    Purpose : Liveness probe used by the frontend / monitoring.

    Inputs  : None

    Output  : JSON { success, app, env, version }

    Example : GET /api/health
              Response: { "success": true, "app": "ExpenseManager", "env": "development", "version": "0.1.0" }
    """
    objLogger.info("📥 HEALTH CHECK")
    return {
        "success": True,
        "app": objSettings.APP_NAME,
        "env": objSettings.APP_ENV,
        "version": "0.1.0",
    }


# ──────────────────────────────────────────────────────────────────────────────
# Router includes (one block added per phase)
# ──────────────────────────────────────────────────────────────────────────────
from routes.auth_routes import router as objAuthRouter
from routes.user_routes import router as objUserRouter
from routes.department_routes import router as objDeptRouter
from routes.category_routes import router as objCategoryRouter
from routes.allowance_routes import router as objAllowanceRouter
from routes.payment_method_routes import router as objPaymentMethodRouter
from routes.attachment_routes import router as objAttachmentRouter
from routes.reimbursement_routes import router as objReimbursementRouter
from routes.approval_routes import router as objApprovalRouter
from routes.notification_routes import router as objNotificationRouter
from routes.sla_routes import router as objSLARouter
from routes.holiday_routes import router as objHolidayRouter
from routes.analytics_routes import router as objAnalyticsRouter

objApp.include_router(objAuthRouter)
objApp.include_router(objUserRouter)
objApp.include_router(objDeptRouter)
objApp.include_router(objCategoryRouter)
objApp.include_router(objAllowanceRouter)
objApp.include_router(objPaymentMethodRouter)
objApp.include_router(objAttachmentRouter)
objApp.include_router(objReimbursementRouter)
objApp.include_router(objApprovalRouter)
objApp.include_router(objNotificationRouter)
objApp.include_router(objSLARouter)
objApp.include_router(objHolidayRouter)
objApp.include_router(objAnalyticsRouter)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:objApp",
        host=objSettings.APP_HOST,
        port=objSettings.APP_PORT,
        reload=True,
        reload_dirs=["sourcecode"],
    )
