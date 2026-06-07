from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://budgetwise:budgetwise@localhost:5432/budgetwise"
    database_url_sync: str = "postgresql://budgetwise:budgetwise@localhost:5432/budgetwise"
    clerk_secret_key: str = ""
    secret_key: str = "change-me-in-production"
    frontend_url: str = "http://localhost:5173"
    plaid_env: str = "mock"

    # Teller.io settings
    teller_env: str = "mock"  # "mock", "sandbox", "production", "disabled"
    teller_application_id: str = ""
    teller_api_key: str = ""
    teller_certificate_path: str = ""  # Path to mTLS cert for production

    # Anthropic API
    anthropic_api_key: str = ""

    # Community rule learning — cross-user rule promotion.
    # Threshold: minimum distinct users that must contribute the same
    # (merchant, category) correction before it gets promoted to a rule.
    community_rule_min_users: int = 5
    # PII safety: salt for hashing user IDs in the signal log. Must be set
    # in production. If empty, signal recording is disabled (fail-closed).
    community_rule_salt: str = ""

    # Database pool settings (only apply to PostgreSQL)
    db_pool_size: int = 10
    db_max_overflow: int = 20
    db_pool_timeout: int = 30
    db_pool_pre_ping: bool = True

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
