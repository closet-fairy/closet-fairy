import random
from decimal import Decimal

import pytest

from app.core.config import Settings
from app.repositories.preference_score import PreferenceRow
from app.services.preference_score import ClassificationResult, classify
from app.services.regeneration_intent import RegenerationIntent
from app.services.regeneration_state import (
    feels_like_offset,
    merge_session_preferences,
    select_session_exploration_style,
)
from tests.test_preference_score import COLORS, STYLES

SETTINGS = Settings(_env_file=None)


def rows(values: list[str], scores: dict[str, tuple[str, str]]) -> list[PreferenceRow]:
    return [
        PreferenceRow(
            v, Decimal(scores.get(v, ("0", "0"))[0]), Decimal(scores.get(v, ("0", "0"))[1]), i
        )
        for i, v in enumerate(values, start=1)
    ]


# casual·minimal 선호, sporty 기피, 나머지 저선호(노출 있음)
STYLE_ROWS = rows(
    STYLES,
    {
        "casual": ("20", "5"),
        "minimal": ("15", "5"),
        "street": ("10", "5"),
        "classic": ("8", "5"),
        "formal": ("6", "5"),
        "romantic": ("4", "5"),
        "vintage": ("3", "5"),
        "sporty": ("-5", "5"),
        "bohemian": ("1", "5"),
        "preppy": ("1", "5"),
        "chic": ("1", "5"),
        "unique": ("1", "5"),
        "feminine": ("1", "5"),
    },
)
# black 기피, white·navy 등 선호
COLOR_ROWS = rows(
    COLORS,
    {
        "black": ("-5", "5"),
        "white": ("20", "5"),
        "navy": ("15", "5"),
        "gray": ("10", "5"),
        "beige": ("8", "5"),
        "brown": ("6", "5"),
        "blue": ("5", "5"),
        "sky_blue": ("4", "5"),
    },
)
STYLE_RESULT = classify("style", STYLE_ROWS, SETTINGS)
COLOR_RESULT = classify("color", COLOR_ROWS, SETTINGS)
NEW_MEMBER_STYLE = classify("style", rows(STYLES, {}), SETTINGS)
NEW_MEMBER_COLOR = classify("color", rows(COLORS, {}), SETTINGS)


def intent(**fields) -> RegenerationIntent:
    return RegenerationIntent(status="ok", **fields)


def partition(result: ClassificationResult) -> list[str]:
    return sorted(result.avoided + result.preferred + result.low_preferred + result.neutral)


def test_fixture_classification_is_as_expected():
    assert STYLE_RESULT.avoided == ["sporty"]
    assert STYLE_RESULT.preferred[:2] == ["casual", "minimal"]
    assert "black" in COLOR_RESULT.avoided
    assert NEW_MEMBER_STYLE.preference_injected is False


def test_no_intents_returns_inputs_unchanged():
    assert merge_session_preferences(STYLE_RESULT, COLOR_RESULT, []) == (
        STYLE_RESULT,
        COLOR_RESULT,
    )


def test_session_preferred_color_overrides_cumulative_avoided():
    _, color = merge_session_preferences(
        STYLE_RESULT, COLOR_RESULT, [intent(preferred_colors=("black",))]
    )

    assert "black" in color.preferred
    assert "black" not in color.avoided
    assert partition(color) == sorted(COLORS)


def test_later_request_overrides_earlier_one():
    style, _ = merge_session_preferences(
        STYLE_RESULT,
        COLOR_RESULT,
        [intent(preferred_styles=("casual",)), intent(avoided_styles=("casual",))],
    )

    assert "casual" in style.avoided
    assert "casual" not in style.preferred
    assert partition(style) == sorted(STYLES)


def test_session_avoided_overrides_cumulative_preferred():
    style, _ = merge_session_preferences(
        STYLE_RESULT, COLOR_RESULT, [intent(avoided_styles=("minimal",))]
    )

    assert style.avoided[0] == "minimal"
    assert "minimal" not in style.preferred


def test_session_preferred_goes_first_with_latest_request_first():
    style, _ = merge_session_preferences(
        STYLE_RESULT,
        COLOR_RESULT,
        [intent(preferred_styles=("street", "chic")), intent(preferred_styles=("vintage",))],
    )

    rest = [v for v in STYLE_RESULT.preferred if v not in {"street", "chic", "vintage"}]
    assert style.preferred == ["vintage", "street", "chic", *rest]
    assert "chic" not in style.low_preferred


def test_preference_by_value_is_kept():
    style, color = merge_session_preferences(
        STYLE_RESULT,
        COLOR_RESULT,
        [intent(preferred_styles=("sporty",), avoided_colors=("white",))],
    )

    assert style.preference_by_value == STYLE_RESULT.preference_by_value
    assert color.preference_by_value == COLOR_RESULT.preference_by_value


def test_other_attribute_type_is_untouched():
    style, color = merge_session_preferences(
        STYLE_RESULT, COLOR_RESULT, [intent(avoided_colors=("white",))]
    )

    assert style == STYLE_RESULT
    assert color != COLOR_RESULT


def test_new_member_gets_only_session_preference_injected():
    style, color = merge_session_preferences(
        NEW_MEMBER_STYLE,
        NEW_MEMBER_COLOR,
        [intent(preferred_styles=("casual",), avoided_colors=("black",))],
    )

    assert style.preference_injected is True
    assert style.preferred == ["casual"]
    assert style.neutral == []
    assert partition(style) == sorted(STYLES)
    assert color.preference_injected is False
    assert color.avoided == ["black"]
    assert "black" not in color.neutral


def test_non_ok_intent_is_rejected():
    with pytest.raises(ValueError):
        merge_session_preferences(
            STYLE_RESULT, COLOR_RESULT, [RegenerationIntent(status="unclear")]
        )


# ---------- 탐색 스타일 ----------


def explore(base, merged, seed=0):
    return select_session_exploration_style(
        base, merged, STYLE_ROWS, 10, SETTINGS, random.Random(seed)
    )


def test_exploration_style_is_reselected_when_it_becomes_session_avoided():
    before = explore(STYLE_RESULT, STYLE_RESULT)
    style, _ = merge_session_preferences(
        STYLE_RESULT, COLOR_RESULT, [intent(avoided_styles=(before,))]
    )

    after = explore(STYLE_RESULT, style)

    assert before is not None
    assert after not in {before, None}
    assert after not in style.avoided + style.preferred


def test_exploration_style_is_reselected_when_it_becomes_session_preferred():
    before = explore(STYLE_RESULT, STYLE_RESULT)
    style, _ = merge_session_preferences(
        STYLE_RESULT, COLOR_RESULT, [intent(preferred_styles=(before,))]
    )

    assert explore(STYLE_RESULT, style) not in {before, None}


def test_no_exploration_when_every_low_preferred_is_taken():
    style, _ = merge_session_preferences(
        STYLE_RESULT,
        COLOR_RESULT,
        [intent(avoided_styles=tuple(STYLE_RESULT.low_preferred))],
    )

    assert explore(STYLE_RESULT, style) is None


def test_new_member_gets_no_exploration_even_with_session_preference():
    style, _ = merge_session_preferences(
        NEW_MEMBER_STYLE, NEW_MEMBER_COLOR, [intent(preferred_styles=("casual",))]
    )

    assert explore(NEW_MEMBER_STYLE, style) is None


# ---------- 체감 조정 ----------


@pytest.mark.parametrize(
    ("warmth", "expected"),
    [
        ([], Decimal("0")),
        (["lighter"], Decimal("3.0")),
        (["warmer"], Decimal("-3.0")),
        (["lighter", "lighter", "lighter"], Decimal("6.0")),
        (["warmer", "warmer", "warmer"], Decimal("-6.0")),
        (["lighter", "lighter", "lighter", "warmer"], Decimal("3.0")),
        (["lighter", None, "warmer"], Decimal("0")),
    ],
)
def test_feels_like_offset_is_clamped_at_each_step(warmth, expected):
    intents = [
        intent(clothing_warmth=w) if w else intent(preferred_styles=("casual",)) for w in warmth
    ]

    assert feels_like_offset(intents, SETTINGS) == expected


def test_feels_like_offset_follows_settings():
    settings = Settings(
        _env_file=None,
        REGENERATION_FEELS_LIKE_STEP=Decimal("2"),
        REGENERATION_FEELS_LIKE_MAX_STEPS=1,
    )

    assert feels_like_offset([intent(clothing_warmth="lighter")] * 3, settings) == Decimal("2")
