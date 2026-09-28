from decimal import Decimal
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

    PREFERENCE_SCORE_EMA_ALPHA: Decimal = Decimal("0.95")
    PREFERENCE_SCORE_PRIOR_WEIGHT: Decimal = Decimal("5")

    SCORE_DELTA_AUTO_REJECTED: Decimal = Decimal("-0.1")
    SCORE_DELTA_REGENERATION_REQUESTED: Decimal = Decimal("-0.5")

    PREFERENCE_SCORE_MIN: Decimal = Decimal("-15.00")
    PREFERENCE_SCORE_MAX: Decimal = Decimal("30.00")
    PREFERENCE_SCORE_DECIMAL_PLACES: int = 2
    PREFERENCE_SCORE_ZERO_EPSILON: Decimal = Decimal("0.05")

    INITIAL_STYLE_BONUS_SCORE: Decimal = Decimal("5.00")

    PREFERRED_TOP_RATIO: Decimal = Decimal("0.5")
    DISLIKE_BOTTOM_RATIO: Decimal = Decimal("0.2")
    DISLIKE_MIN_FEEDBACK_COUNT: int = 3

    EXPLORATION_UCB_COEFFICIENT: Decimal = Decimal("0.5")

    OUTER_REQUIRED_FEELS_LIKE_TEMPERATURE: Decimal = Decimal("16.0")
    SUMMER_AVG_TEMPERATURE_THRESHOLD: Decimal = Decimal("20.0")

    MAX_RETRY_PER_VALIDATION_STAGE: int = 2

    LLM_DEFAULT_MODEL: str = "claude-sonnet-5"
    # 용도(call_name)별 모델 덮어쓰기. .env에 JSON으로 적는다.
    # 예: LLM_MODEL_OVERRIDES={"image_tagging": "claude-haiku-4-5"}
    LLM_MODEL_OVERRIDES: dict[str, str] = {}
    LLM_MAX_ATTEMPTS: int = 3
    LLM_BACKOFF_BASE_S: float = 0.5
    LLM_BACKOFF_MAX_S: float = 8.0


@lru_cache
def get_settings() -> Settings:
    return Settings()
