"""
FastAPI Application Factory.
==============================
Creates and configures the application, mounts module routers,
and manages the scheduler lifecycle.
"""

import logging
import sys
import asyncio
import concurrent.futures
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.database import init_async_engine, dispose_async_engine
from app.core.exceptions import AppError
from app.core.logging import setup_logging
from app.core import scheduler as core_scheduler

# --- Module routers ---
from app.modules.cot.router import router as cot_router, warmup_cot_caches
from app.modules.auth.router import router as auth_router
from app.modules.users.router import router as users_router
from app.modules.journal.router import router as journal_router
from app.modules.market_data.router import router as market_data_router
from app.modules.admin.router import router as admin_router
from app.modules.cot.scheduler import register_scheduled_job
from app.modules.prices.scheduler import register_daily_price_job

logger = logging.getLogger(__name__)


# ------------------------------------------------------------------
# Lifespan
# ------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: configure logging, create dirs, init DB engines, start scheduler."""
    setup_logging()
    settings.ensure_directories()

    logger.info("Starting %s v%s", settings.app_name, settings.app_version)

    # Initialise async PostgreSQL engine (auth + journal)
    init_async_engine()
    logger.info("PostgreSQL engine ready")

    # Register module jobs and start scheduler
    register_scheduled_job()       # COT pipeline — every Friday 23:00 Kyiv
    register_daily_price_job()     # Price update — every day 00:00 Kyiv
    core_scheduler.start()

    # Cap the default thread-pool to 2 workers so that heavy numpy/pandas
    # analytics don't run 5+ in parallel and thrash the 1 GB RAM.
    loop = asyncio.get_running_loop()
    loop.set_default_executor(concurrent.futures.ThreadPoolExecutor(max_workers=2))

    # Warm up COT caches in background (don't block startup)
    asyncio.create_task(warmup_cot_caches())

    yield

    logger.info("Shutting down...")
    core_scheduler.shutdown()

    # Dispose PostgreSQL connection pool
    await dispose_async_engine()


# ------------------------------------------------------------------
# App factory
# ------------------------------------------------------------------

def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    app = FastAPI(
        title=settings.app_name,
        description="Financial data analytics platform — COT reports, price data, and more.",
        version=settings.app_version,
        lifespan=lifespan,
        docs_url="/api/docs",
        redoc_url="/api/redoc",
        openapi_url="/api/openapi.json",
    )

    # --- CORS ---
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.api_cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # --- Exception handler ---
    @app.exception_handler(AppError)
    async def app_error_handler(request: Request, exc: AppError):
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.message},
        )

    # --- Mount module routers ---
    app.include_router(auth_router, prefix="/api/v1")
    app.include_router(users_router, prefix="/api/v1")
    app.include_router(admin_router, prefix="/api/v1")
    app.include_router(cot_router, prefix="/api/v1")
    app.include_router(journal_router, prefix="/api/v1")
    app.include_router(market_data_router, prefix="/api/v1")

    return app


# Application instance used by uvicorn
app = create_app()
