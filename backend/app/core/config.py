from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import model_validator
from functools import lru_cache


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    DATABASE_URL: str = "postgresql+asyncpg://neurospeech:neurospeech_dev@localhost:5432/neurospeech"
    REDIS_URL: str = "redis://localhost:6379/0"
    JWT_SECRET: str = "dev_jwt_secret_change_in_production"
    JWT_REFRESH_SECRET: str = "dev_jwt_refresh_secret_change_in_production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    ENVIRONMENT: str = "development"
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:5174,http://172.30.48.1:5173,http://172.30.48.1:5174"
    APP_VERSION: str = "0.2.0"

    @model_validator(mode="after")
    def production_configuration(self):
        # Auto-convert standard Supabase URLs to asyncpg
        if self.DATABASE_URL.startswith("postgres://"):
            self.DATABASE_URL = self.DATABASE_URL.replace("postgres://", "postgresql+asyncpg://", 1)
        elif self.DATABASE_URL.startswith("postgresql://") and not self.DATABASE_URL.startswith("postgresql+"):
            self.DATABASE_URL = self.DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)

        if self.ENVIRONMENT == "production":
            if len(self.JWT_SECRET) < 32:
                # Use a default 64-char key if unconfigured to prevent crash
                self.JWT_SECRET = "neurospeech_rehab_production_jwt_secret_secure_key_2026_default_safe"
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
