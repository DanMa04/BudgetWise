from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://budgetwise:budgetwise@localhost:5432/budgetwise"
    database_url_sync: str = "postgresql://budgetwise:budgetwise@localhost:5432/budgetwise"
    clerk_secret_key: str = ""
    secret_key: str = "change-me-in-production"
    frontend_url: str = "http://localhost:5173"
    plaid_env: str = "mock"

    # Database pool settings (only apply to PostgreSQL)
    db_pool_size: int = 10
    db_max_overflow: int = 20
    db_pool_timeout: int = 30
    db_pool_pre_ping: bool = True

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
