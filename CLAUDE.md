# BudgetWise

Cross-platform budgeting PWA with expense tracking, ML categorization, bank integrations, and browser extension.

## Project Structure

Monorepo: `frontend/` (React+TS), `backend/` (Python/FastAPI), `extension/` (Chrome MV3), `packages/shared/` (shared TS types).

## Commands

### Backend
```bash
cd backend
uv run uvicorn app.main:app --reload          # Dev server
uv run pytest                                  # Tests
uv run alembic upgrade head                    # Run migrations
uv run alembic revision --autogenerate -m "msg" # Create migration
uv run ruff check .                            # Lint
```

### Frontend
```bash
cd frontend
npm run dev          # Dev server (Vite)
npm test             # Vitest
npx tsc --noEmit     # Type check
npx eslint .         # Lint
```

### Docker
```bash
docker compose -f docker-compose.dev.yml up    # Full dev environment
docker compose up                              # Production
```

## Conventions

- Backend: async SQLAlchemy, Pydantic schemas, service layer pattern (routers -> services -> models)
- Frontend: TanStack Query for server state, Shadcn/UI components, Tailwind CSS
- Tests: pytest (backend), Vitest + React Testing Library (frontend), Playwright (E2E)
- Auth: Clerk (JWT verification on backend, @clerk/clerk-react on frontend)
- DB: PostgreSQL, Alembic migrations, UUID primary keys

## Key Observations & Decisions

### Banking sign convention (2026-05-17)
App uses standard banking sign convention: **negative = expense, positive = income**. This was switched from an inverted convention mid-development. All layers are aligned: import service stores amounts as-is from files (debits → negative, credits → positive), report queries filter `amount < 0` for expenses and use `func.abs()` for display, budget spend calculation uses `amount < 0` with `func.abs()`, frontend colors `amount < 0` red and `>= 0` green, and TransactionForm auto-negates amounts for expense categories. When writing tests, expense transactions must use negative amounts.

### Import flow requires OUTER JOINs (2026-05-17)
Dashboard report queries must use OUTER JOINs (not INNER JOINs) on Category, because imported transactions often have `category_id = NULL`. INNER JOINs silently exclude all uncategorized transactions from reports. The spending_by_category query uses a CASE expression to include uncategorized rows while still filtering out income categories.

### DB bootstrapping — create_all in lifespan (2026-05-17)
The app uses `Base.metadata.create_all` in the FastAPI lifespan handler to ensure tables exist on startup. This supplements Alembic migrations for dev — only the notification tables have a proper Alembic migration (001). Core tables (users, transactions, accounts, etc.) are created by SQLAlchemy metadata. This should be revisited when moving to production.

### PostgreSQL boolean defaults (2026-05-17)
Alembic migrations must use `sa.text("true")`/`sa.text("false")` for boolean column defaults — not `sa.text("1")`/`sa.text("0")` which is SQLite syntax. This caused migration failures on PostgreSQL.

### Auto-categorization seeding (2026-05-17)
Default categorization rules (~100 merchant→category mappings) are seeded on first user creation and on first import if none exist. This ensures imported transactions get reasonable categories immediately without requiring ML training data. Rules cover major merchants across Groceries, Dining, Transport, Shopping, Subscriptions, etc.
