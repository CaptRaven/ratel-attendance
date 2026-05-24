from functools import lru_cache
from pathlib import Path
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BASE_DIR / ".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # App
    APP_NAME: str = "Ratel Attendance"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    ENVIRONMENT: str = "development"

    # Database
    DATABASE_URL: str

    # Redis
    REDIS_URL: str

    # JWT
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days

    # QR Token
    QR_TOKEN_TTL_SECONDS: int = 30
    QR_SESSION_SECRET: str

    # Location
    DEFAULT_LOCATION_ID: str = "ratel-hq"

    @property
    def async_database_url(self) -> str:
        if self.DATABASE_URL.startswith("postgresql+asyncpg://"):
            return self.DATABASE_URL
        if self.DATABASE_URL.startswith("postgresql://"):
            return self.DATABASE_URL.replace(
                "postgresql://",
                "postgresql+asyncpg://",
                1,
            )
        return self.DATABASE_URL

    @field_validator("DEBUG", mode="before")
    @classmethod
    def parse_debug_flag(cls, value):
        if isinstance(value, bool):
            return value
        if isinstance(value, str):
            normalized = value.strip().lower()
            if normalized in {"true", "1", "yes", "on", "debug", "development"}:
                return True
            if normalized in {"false", "0", "no", "off", "release", "production"}:
                return False
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()
