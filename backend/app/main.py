from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import (
    accounts,
    auth,
    budgets,
    categories,
    categorization,
    import_,
    plaid,
    reports,
    transactions,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


app = FastAPI(title="BudgetWise API", version="0.1.0", lifespan=lifespan)

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


@app.get("/api/health")
async def health():
    return {"status": "ok"}
