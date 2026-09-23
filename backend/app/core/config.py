from decimal import Decimal
from functools import lru_cache

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

<<<<<<< HEAD
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

=======
>>>>>>> main

@lru_cache
def get_settings() -> Settings:
    return Settings()