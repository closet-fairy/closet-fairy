import shutil
from decimal import Decimal
from pathlib import Path

from app.core.config import Settings

ENV_EXAMPLE = Path(__file__).resolve().parent.parent / ".env.example"


def test_env_example_passes_settings_validation(tmp_path):
    env_file = tmp_path / ".env"
    shutil.copy(ENV_EXAMPLE, env_file)

    Settings(_env_file=env_file)


def test_tuned_preference_score_defaults():
    settings = Settings(_env_file=None)

    assert settings.PREFERENCE_SCORE_MAX == Decimal("60.00")
    assert settings.PREFERENCE_SCORE_MIN == Decimal("-20.00")
    assert settings.DISLIKE_MIN_FEEDBACK_COUNT == Decimal("2.85")
    assert settings.SCORE_DELTA_RATING_5 == Decimal("3.0")
    assert settings.SCORE_DELTA_RATING_4 == Decimal("2.0")
    assert settings.SCORE_DELTA_RATING_3 == Decimal("1.0")
    assert settings.SCORE_DELTA_RATING_2 == Decimal("0.0")
    assert settings.SCORE_DELTA_RATING_1 == Decimal("-1.0")


def test_reviewer_model_defaults_to_haiku():
    assert Settings(_env_file=None).LLM_REVIEWER_MODEL == "claude-haiku-4-5"
