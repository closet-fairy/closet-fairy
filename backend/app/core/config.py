from decimal import Decimal
from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    APP_NAME: str = "Outfit Recommendation API"
    ENV: str = "development"
    DEV_AUTH: bool = True
    DATABASE_URL: str = "mysql+aiomysql://root:dev@localhost:3306/fashion"
    ANTHROPIC_API_KEY: str = ""
    KMA_SERVICE_KEY: str = ""
    KMA_TIMEOUT_SECONDS: float = 5.0
    DEV_MEMBER_ID: int = 1

    SEASON_MOVING_AVERAGE_WINDOW_DAYS: int = 9
    SEASON_DATA_MAX_STALENESS_DAYS: int = 2
    SUMMER_AVG_TEMPERATURE_THRESHOLD: Decimal = Decimal("20.0")
    WINTER_AVG_TEMPERATURE_THRESHOLD: Decimal = Decimal("5.0")

    PREFERENCE_SCORE_EMA_ALPHA: Decimal = Decimal("0.95")
    PREFERENCE_SCORE_PRIOR_WEIGHT: Decimal = Decimal("5")

    SCORE_DELTA_AUTO_REJECTED: Decimal = Decimal("-0.1")
    SCORE_DELTA_REGENERATION_REQUESTED: Decimal = Decimal("-0.5")
    SCORE_DELTA_RATING_5: Decimal = Decimal("3.0")
    SCORE_DELTA_RATING_4: Decimal = Decimal("2.0")
    SCORE_DELTA_RATING_3: Decimal = Decimal("1.0")
    SCORE_DELTA_RATING_2: Decimal = Decimal("0.0")
    SCORE_DELTA_RATING_1: Decimal = Decimal("-1.0")

    # EMA 정상상태 범위는 델타 / (1 - alpha)이므로 상한은 3.0 / 0.05 = 60,
    # 하한은 -1.0 / 0.05 = -20이다. 상한을 30으로 두면 취향이 강한 속성들이
    # 전부 30에 붙어 구분이 사라진다.
    PREFERENCE_SCORE_MIN: Decimal = Decimal("-20.00")
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
    OUTER_EXCLUDED_FEELS_LIKE_TEMPERATURE: Decimal = Decimal("20.0")
    THICK_CLOTHING_MAX_FEELS_LIKE_TEMPERATURE: Decimal = Decimal("20.0")
    THIN_CLOTHING_MIN_FEELS_LIKE_TEMPERATURE: Decimal = Decimal("5.0")

    MAX_RETRY_PER_VALIDATION_STAGE: int = 2

    SESSION_ABANDON_TIMEOUT_MINUTES: int = 30

    MEDIA_ROOT: Path = Path("media")
    MEDIA_URL_PREFIX: str = "/media"
    CLOTHING_UPLOAD_MAX_FILES: int = 20
    CLOTHING_UPLOAD_MAX_BYTES: int = 20 * 1024 * 1024
    CLOTHING_IMAGE_WEBP_QUALITY: int = 90
    CLOTHING_IMAGE_MAX_PIXELS: int = 50_000_000
    CLOTHING_IMAGE_NORMALIZE_CONCURRENCY: int = 4

    LLM_DEFAULT_MODEL: str = "claude-sonnet-5"
    # 용도(call_name)별 모델 덮어쓰기. .env에 JSON으로 적는다.
    # 예: LLM_MODEL_OVERRIDES={"image_tagging": "claude-haiku-4-5"}
    LLM_MODEL_OVERRIDES: dict[str, str] = {}
    # 리뷰어는 이 값을 LLMCallConfig.model로 넘겨 LLM_MODEL_OVERRIDES보다 우선한다.
    # overrides에 기본값을 두면 .env에서 dict를 지정할 때 통째로 덮여 사라지므로 따로 둔다
    LLM_REVIEWER_MODEL: str = "claude-haiku-4-5"
    LLM_MAX_ATTEMPTS: int = 3
    LLM_BACKOFF_BASE_S: float = 0.5
    LLM_BACKOFF_MAX_S: float = 8.0


@lru_cache
def get_settings() -> Settings:
    return Settings()
