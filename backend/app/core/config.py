from pathlib import Path

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


BACKEND_DIR = Path(__file__).resolve().parents[2]
ROOT_ENV_FILE = BACKEND_DIR / ".env"
ADMIN_ENV_FILE = BACKEND_DIR / ".env.admin"


class Settings(BaseSettings):
    app_name: str = "Trade Shield Africa API"
    api_prefix: str = "/api/v1"
    database_url: str = "sqlite+aiosqlite:///./tradeshield.db"
    frontend_url: str = "http://localhost:3000"
    app_url: str = "http://localhost:3000"
    openai_api_key: str | None = None
    paystack_secret_key: str | None = None
    virustotal_api_key: str | None = None
    google_safe_browsing_api_key: str | None = None
    jwt_secret_key: str = "development-only-change-me-not-for-production-rotate-this-secret"
    admin_username: str = "tradeshield"
    admin_password: SecretStr | None = None
    admin_email: str = "tradeshield-admin@trade-shield.example.com"
    scan_price_kes: int = 500
    consultation_price_kes: int = 2000
    model_config = SettingsConfigDict(env_file=(ROOT_ENV_FILE, ADMIN_ENV_FILE), extra="ignore", case_sensitive=False)


settings = Settings()
