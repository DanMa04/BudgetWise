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
