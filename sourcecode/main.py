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

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from env_config import objSettings
from config.mongodb_config import ensure_indexes, ping_mongo


# ──────────────────────────────────────────────────────────────────────────────
# Logging setup (rotating file + console)
# ──────────────────────────────────────────────────────────────────────────────
strLogDir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "logs")
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
@asynccontextmanager
async def lifespan(objApp: FastAPI):
    """
    Purpose : Run startup (Mongo ping + indexes) and shutdown tasks.

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
    yield
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

objApp.include_router(objAuthRouter)
objApp.include_router(objUserRouter)
objApp.include_router(objDeptRouter)
objApp.include_router(objCategoryRouter)
objApp.include_router(objAllowanceRouter)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:objApp",
        host=objSettings.APP_HOST,
        port=objSettings.APP_PORT,
        reload=True,
    )
