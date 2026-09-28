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
    SCORE_DELTA_RATING_5: Decimal = Decimal("3.0")
    SCORE_DELTA_RATING_4: Decimal = Decimal("2.0")
    SCORE_DELTA_RATING_3: Decimal = Decimal("1.0")
    SCORE_DELTA_RATING_2: Decimal = Decimal("0.0")
    SCORE_DELTA_RATING_1: Decimal = Decimal("-1.0")

    PREFERENCE_SCORE_MIN: Decimal = Decimal("-15.00")
    # EMA 정상상태 상한은 최대 델타 / (1 - alpha) = 3.0 / 0.05 = 60이다. 30으로 두면
    # 취향이 강한 속성들이 전부 30에 붙어 구분이 사라진다. 하한은 -0.5 / 0.05 = -10이라
    # MIN -15는 여유가 있다.
    PREFERENCE_SCORE_MAX: Decimal = Decimal("60.00")
    PREFERENCE_SCORE_DECIMAL_PLACES: int = 2
    PREFERENCE_SCORE_ZERO_EPSILON: Decimal = Decimal("0.05")

    INITIAL_STYLE_BONUS_SCORE: Decimal = Decimal("5.00")

    PREFERRED_TOP_RATIO: Decimal = Decimal("0.5")
    DISLIKE_BOTTOM_RATIO: Decimal = Decimal("0.2")
    # exposure_count는 정수가 아니라 EMA 값이다. 노출 3회면 1 → 1.95 → 2.85이므로,
    # 3.0으로 두면 실제로는 4회 노출을 요구하게 된다.
    DISLIKE_MIN_FEEDBACK_COUNT: Decimal = Decimal("2.85")

    EXPLORATION_UCB_COEFFICIENT: Decimal = Decimal("0.5")

    OUTER_REQUIRED_FEELS_LIKE_TEMPERATURE: Decimal = Decimal("16.0")
    SUMMER_AVG_TEMPERATURE_THRESHOLD: Decimal = Decimal("20.0")

    MAX_RETRY_PER_VALIDATION_STAGE: int = 2

@lru_cache
def get_settings() -> Settings:
    return Settings()