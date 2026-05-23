from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.responses import JSONResponse

from app.config import settings
from app.database import get_db
from app.middleware.rate_limit import limiter
from app.middleware.security_headers import SecurityHeadersMiddleware
from app.routers import (
    accounts,
    auth,
    budgets,
    categories,
    categorization,
    extension,
    goals,
    import_,
    notifications,
    plaid,
    reports,
    teller,
    transactions,
    transfer_rules,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    import app.models  # noqa: F401 — ensure all models are registered
    from app.database import Base, engine

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield


app = FastAPI(title="BudgetWise API", version="0.1.0", lifespan=lifespan)

# --- Rate limiter setup ---
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# --- Middleware (order matters: last added runs first) ---
# GZip compression for large responses
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Security headers on every response
app.add_middleware(SecurityHeadersMiddleware)

# Rate limiting
app.add_middleware(SlowAPIMiddleware)

# CORS (outermost — runs first on requests, last on responses)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/v1")
app.include_router(accounts.router, prefix="/api/v1")
app.include_router(transactions.router, prefix="/api/v1")
app.include_router(budgets.router, prefix="/api/v1")
app.include_router(categories.router, prefix="/api/v1")
app.include_router(categorization.router, prefix="/api/v1")
app.include_router(import_.router, prefix="/api/v1")
app.include_router(plaid.router, prefix="/api/v1")
app.include_router(reports.router, prefix="/api/v1")
app.include_router(goals.router, prefix="/api/v1")
app.include_router(notifications.router, prefix="/api/v1")
app.include_router(teller.router, prefix="/api/v1")
app.include_router(transfer_rules.router, prefix="/api/v1")
app.include_router(extension.router, prefix="/api/v1")


@app.get("/api/health")
async def health(db: AsyncSession = Depends(get_db)):
    version = "0.1.0"
    try:
        await db.execute(text("SELECT 1"))
        return {"status": "ok", "database": "ok", "version": version}
    except Exception:
        return JSONResponse(
            status_code=503,
            content={"status": "degraded", "database": "error", "version": version},
        )
