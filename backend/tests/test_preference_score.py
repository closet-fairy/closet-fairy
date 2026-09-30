import logging
import random
from decimal import Decimal

from app.core.config import Settings
from app.core.logging import Event
from app.services.preference_score import (
    ClassificationResult,
    PreferenceRow,
    classify,
    select_exploration_style,
    update_ema,
)

SETTINGS = Settings(_env_file=None)

STYLES = ["minimal", "casual", "street", "classic", "formal", "sporty", "romantic",
          "vintage", "bohemian", "preppy", "chic", "unique", "feminine"]
COLORS = ["black", "white", "gray", "beige", "brown", "navy", "blue",
          "sky_blue", "green", "khaki", "yellow", "orange", "red", "pink"]


def make_rows(values, scores=None, default=("0", "0")):
    """scores: {값: (S, N)}. 지정하지 않은 값은 default."""
    scores = scores or {}
    return [
        PreferenceRow(v, Decimal(scores.get(v, default)[0]), Decimal(scores.get(v, default)[1]),
                      seq)
        for seq, v in enumerate(values, start=1)
    ]


def ema(s, n, delta):
    return update_ema(Decimal(s), Decimal(n), Decimal(delta), SETTINGS)


# ---------- EMA ----------

def test_ema_exposure_count_after_three_zero_delta_updates():
    s, n = Decimal("0"), Decimal("0")
    counts = []
    for _ in range(3):
        s, n = update_ema(s, n, Decimal("0"), SETTINGS)
        counts.append(str(n))
    assert counts == ["1.00", "1.95", "2.85"]
    assert str(s) == "0.00"


def test_ema_upper_bound_steady_state_stays_at_max():
    assert ema("60.00", "20", "3.0")[0] == Decimal("60.00")


def test_ema_clips_to_max():
    assert str(ema("60.00", "20", "4.0")[0]) == "60.00"  # 61.00


def test_ema_clips_to_min():
    assert str(ema("-15.00", "20", "-2.0")[0]) == "-15.00"  # -16.25


def test_ema_small_score_snaps_to_zero():
    assert str(ema("0.04", "1", "0")[0]) == "0.00"
    assert str(ema("-0.04", "1", "0")[0]) == "0.00"


def test_ema_rounds_half_up():
    assert str(ema("0.30", "1", "0")[0]) == "0.29"  # 0.285, HALF_EVEN이면 0.28
    assert str(ema("-0.30", "1", "0")[0]) == "-0.29"


def test_ema_zero_delta_still_increases_exposure():
    assert ema("5.00", "0", "0") == (Decimal("4.75"), Decimal("1.00"))


# ---------- 분류 ----------

def test_new_member_not_injected():
    result = classify("style", make_rows(STYLES), SETTINGS)
    assert result.avoided == []
    assert result.preference_injected is False
    assert result.preferred == [] and result.low_preferred == []
    assert result.neutral == STYLES


def test_initial_bonus_only_member():
    rows = make_rows(STYLES, {"street": ("5", "0"), "chic": ("5", "0")})
    result = classify("style", rows, SETTINGS)
    assert result.preference_injected is True
    assert result.avoided == []
    assert result.preferred == ["street", "chic"]
    assert result.low_preferred == [v for v in STYLES if v not in ("street", "chic")]
    assert result.neutral == []


def test_lowest_but_positive_is_not_avoided():
    rows = make_rows(STYLES, {v: (str(i), "3") for i, v in enumerate(STYLES, start=1)})
    result = classify("style", rows, SETTINGS)
    assert result.avoided == []
    assert result.low_preferred[-1] == "minimal"


def test_avoid_requires_min_exposure():
    two_exposures = classify("style", make_rows(STYLES, {"street": ("-3", "1.95")}), SETTINGS)
    assert two_exposures.avoided == []
    three_exposures = classify("style", make_rows(STYLES, {"street": ("-3", "2.85")}), SETTINGS)
    assert three_exposures.avoided == ["street"]


def test_avoided_capped_by_bottom_ratio():
    scores = {v: (str(-i), "3") for i, v in enumerate(STYLES[:5], start=1)}
    result = classify("style", make_rows(STYLES, scores), SETTINGS)
    assert result.avoided == ["classic", "formal"]  # p 최하위 2개, p 내림차순


def test_avoided_boundary_tie_group_excluded():
    scores = {"minimal": ("-3", "3"), "casual": ("-2", "3"), "street": ("-2", "3")}
    result = classify("style", make_rows(STYLES, scores), SETTINGS)
    assert result.avoided == ["minimal"]


def test_preferred_boundary_tie_included():
    s_values = [10, 9, 8, 7, 6, 5, 4, 4, 4, 1, 1, 1, 0]
    rows = make_rows(STYLES, {v: (str(s), "0") for v, s in zip(STYLES, s_values)})
    result = classify("style", rows, SETTINGS)
    assert len(result.preferred) == 9  # k = ceil(13 / 2) = 7, 7~9위 동점
    assert result.preferred == STYLES[:9]
    assert result.low_preferred == STYLES[9:]


def test_preferred_rounds_up_when_eleven_remain():
    scores = {v: (str(i), "3") for i, v in enumerate(STYLES, start=1)}
    scores["minimal"] = ("-10", "3")
    scores["casual"] = ("-9", "3")
    result = classify("style", make_rows(STYLES, scores), SETTINGS)
    assert len(result.avoided) == 2
    assert len(result.preferred) == 6
    assert len(result.low_preferred) == 5


def test_style_and_color_classified_independently():
    style_rows = make_rows(STYLES, {"street": ("5", "0")})
    color_rows = make_rows(COLORS, {"black": ("-3", "3"), "white": ("-2", "3")})
    style_result = classify("style", style_rows, SETTINGS)
    color_result = classify("color", color_rows, SETTINGS)

    assert style_result.attribute_type == "style"
    assert style_result.avoided == []
    assert style_result.preferred == ["street"]

    assert color_result.attribute_type == "color"
    assert color_result.avoided == ["white", "black"]
    assert color_result.preference_injected is False
    assert color_result.neutral == COLORS[2:]


# ---------- UCB ----------

def pick(rows, n_sessions=5, seed=0):
    result = classify("style", rows, SETTINGS)
    return select_exploration_style(result, rows, n_sessions, SETTINGS, random.Random(seed))


def test_ucb_excludes_preferred_and_avoided():
    scores = {v: ("0", "50") for v in STYLES}
    scores.update({"minimal": ("3", "0"), "casual": ("2", "0"), "street": ("1", "0")})
    scores.update({"feminine": ("-0.1", "2.85"), "unique": ("-0.2", "2.85")})
    rows = make_rows(STYLES, scores)

    result = classify("style", rows, SETTINGS)
    assert result.preferred == ["minimal", "casual", "street"]
    assert result.avoided == ["feminine", "unique"]

    allowed = set(STYLES) - {"minimal", "casual", "street", "feminine", "unique"}
    for seed in range(20):
        assert pick(rows, seed=seed) in allowed


def test_ucb_picks_low_preferred_even_with_lower_ranked_preferred():
    scores = {v: ("0", "50") for v in STYLES}
    scores.update({"minimal": ("5", "0"), "casual": ("4", "0"), "street": ("3", "0"),
                   "classic": ("2", "0"), "formal": ("1", "0")})
    rows = make_rows(STYLES, scores)

    result = classify("style", rows, SETTINGS)
    assert result.preferred == ["minimal", "casual", "street", "classic", "formal"]

    for seed in range(20):
        assert pick(rows, seed=seed) in result.low_preferred


def test_ucb_not_injected_excludes_only_avoided():
    scores = {v: ("0", "50") for v in STYLES}
    scores["minimal"] = ("0", "0")
    scores.update({"feminine": ("-3", "3"), "unique": ("-2", "3")})
    rows = make_rows(STYLES, scores)

    result = classify("style", rows, SETTINGS)
    assert result.preference_injected is False
    assert pick(rows) == "minimal"


def test_ucb_unexposed_style_wins():
    scores = {v: ("10", "1") for v in STYLES}
    scores["preppy"] = ("0", "0")
    assert pick(make_rows(STYLES, scores)) == "preppy"


def test_ucb_unexposed_ties_are_deterministic_per_seed():
    rows = make_rows(STYLES)
    assert pick(rows, seed=42) == pick(rows, seed=42)
    assert len({pick(rows, seed=seed) for seed in range(30)}) > 1


def test_ucb_uses_ln2_for_zero_or_one_session(caplog):
    rows = make_rows(STYLES, default=("0", "1"))
    for n_sessions in (0, 1):
        caplog.clear()
        with caplog.at_level(logging.INFO):
            assert pick(rows, n_sessions=n_sessions) in STYLES
        record = next(r for r in caplog.records if r.event == Event.UCB_EXPLORE_PICK)
        assert record.ucb == Decimal("0.4163")  # 0.5 × sqrt(ln 2 / 1)
        assert not hasattr(record, "member_id")


def test_ucb_returns_none_without_candidates():
    values = ["minimal", "casual", "street", "classic", "formal"]
    rows = make_rows(values)
    result = ClassificationResult(
        attribute_type="style",
        preference_injected=True,
        avoided=["formal"],
        preferred=["minimal", "casual", "street", "classic"],
        low_preferred=[],
        neutral=[],
        preference_by_value={v: Decimal("0") for v in values},
    )
    assert select_exploration_style(result, rows, 3, SETTINGS, random.Random(0)) is None
