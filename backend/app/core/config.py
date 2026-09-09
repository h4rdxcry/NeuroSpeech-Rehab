from pydantic_settings import BaseSettings
from pydantic import model_validator
from functools import lru_cache

class Settings(BaseSettings):
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
        if self.ENVIRONMENT == "production":
            if len(self.JWT_SECRET) < 32 or self.JWT_SECRET.startswith("dev_"):
                raise ValueError("Production requires a unique JWT_SECRET of at least 32 characters")
            if not self.DATABASE_URL.startswith("postgresql+asyncpg://"):
                raise ValueError("Production requires PostgreSQL with asyncpg")
        return self

    class Config:
        env_file = ".env"

@lru_cache
def get_settings() -> Settings:
    return Settings()
