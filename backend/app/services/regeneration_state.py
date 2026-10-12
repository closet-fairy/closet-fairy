"""재추천 요청들을 누적 선호 분류 결과에 세션 우선으로 병합한다 (#83, FR-REF-08~11)."""

import random
from collections.abc import Sequence
from dataclasses import replace
from decimal import Decimal

from app.core.config import Settings
from app.repositories.preference_score import PreferenceRow
from app.services.preference_score import ClassificationResult, select_exploration_style
from app.services.regeneration_intent import RegenerationIntent


def merge_session_preferences(
    style_result: ClassificationResult,
    color_result: ClassificationResult,
    intents: Sequence[RegenerationIntent],
) -> tuple[ClassificationResult, ClassificationResult]:
    _require_ok(intents)
    merged_style = _merge(style_result, [(i.preferred_styles, i.avoided_styles) for i in intents])
    merged_color = _merge(color_result, [(i.preferred_colors, i.avoided_colors) for i in intents])
    return merged_style, merged_color


def feels_like_offset(intents: Sequence[RegenerationIntent], settings: Settings) -> Decimal:
    _require_ok(intents)
    limit = settings.REGENERATION_FEELS_LIKE_MAX_STEPS
    steps = 0
    for intent in intents:
        if intent.clothing_warmth == "lighter":
            steps = min(steps + 1, limit)
        elif intent.clothing_warmth == "warmer":
            steps = max(steps - 1, -limit)
    return settings.REGENERATION_FEELS_LIKE_STEP * steps


def select_session_exploration_style(
    base_style_result: ClassificationResult,
    merged_style_result: ClassificationResult,
    rows: Sequence[PreferenceRow],
    n_sessions: int,
    settings: Settings,
    rng: random.Random,
) -> str | None:
    # 세션 선호가 들어오면 병합 결과는 injected가 True가 되므로,
    # 신규 회원 여부는 병합 전 결과로 판단한다
    if not base_style_result.preference_injected:
        return None
    return select_exploration_style(merged_style_result, rows, n_sessions, settings, rng)


def _require_ok(intents: Sequence[RegenerationIntent]) -> None:
    statuses = sorted({i.status for i in intents} - {"ok"})
    if statuses:
        raise ValueError(f"병합할 수 없는 의도가 있습니다: {statuses}")


def _merge(
    result: ClassificationResult,
    changes: Sequence[tuple[Sequence[str], Sequence[str]]],
) -> ClassificationResult:
    session_preferred: list[str] = []
    session_avoided: list[str] = []
    for preferred, avoided in changes:
        changed = set(preferred) | set(avoided)
        session_preferred = [*preferred, *(v for v in session_preferred if v not in changed)]
        session_avoided = [*avoided, *(v for v in session_avoided if v not in changed)]
    if not session_preferred and not session_avoided:
        return result

    touched = set(session_preferred) | set(session_avoided)

    def untouched(values: Sequence[str]) -> list[str]:
        return [v for v in values if v not in touched]

    preferred = session_preferred + untouched(result.preferred)
    low_preferred = untouched(result.low_preferred)
    neutral = untouched(result.neutral)
    injected = result.preference_injected or bool(session_preferred)
    if injected and not result.preference_injected:
        low_preferred, neutral = neutral, []

    return replace(
        result,
        preference_injected=injected,
        avoided=session_avoided + untouched(result.avoided),
        preferred=preferred,
        low_preferred=low_preferred,
        neutral=neutral,
    )
