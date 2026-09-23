from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    APP_NAME: str = "Outfit Recommendation API"
    ENV: str = "development"
    DEV_AUTH: bool = True
    DATABASE_URL: str = "mysql+aiomysql://root:dev@localhost:3306/fashion"
    ANTHROPIC_API_KEY: str = ""
    KMA_SERVICE_KEY: str = ""


@lru_cache
def get_settings() -> Settings:
    return Settings()