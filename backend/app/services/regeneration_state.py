"""재추천 요청들을 누적 선호 분류 결과에 세션 우선으로 병합한다 (#83, FR-REF-08~11)."""

import json
import random
from collections.abc import Sequence
from dataclasses import dataclass, replace
from decimal import Decimal
from functools import lru_cache
from pathlib import Path
from typing import Literal, NamedTuple, get_args

from app.core.config import Settings
from app.repositories.preference_score import PreferenceRow
from app.schemas.codes import StyleCd
from app.services.preference_score import ClassificationResult, select_exploration_style
from app.services.regeneration_intent import RegenerationIntent

STYLE_FORMALITY_PATH = Path(__file__).resolve().parents[2] / "config" / "style_formality.json"

FormalityDirectionCd = Literal["more", "less"]


class _Change(NamedTuple):
    preferred: Sequence[str]
    inferred: Sequence[str]
    avoided: Sequence[str]


class StyleFormalityConfigError(RuntimeError):
    pass


@dataclass(frozen=True)
class FormalitySignals:
    less_formal: frozenset[str]
    more_formal: frozenset[str]


@dataclass(frozen=True)
class StyleFormality:
    preferred: FormalitySignals
    avoided: FormalitySignals


@dataclass(frozen=True)
class FormalityDirection:
    direction: FormalityDirectionCd
    is_current: bool


# intents는 request_seq 오름차순(오래된 요청 먼저)으로 넘긴다.
# 직접 말한 값은 뒤 요청이 앞 요청을 덮고, 풀어서 채운 선호는 앞 요청과 누적의 기피를 덮지 않는다
def merge_session_preferences(
    style_result: ClassificationResult,
    color_result: ClassificationResult,
    intents: Sequence[RegenerationIntent],
) -> tuple[ClassificationResult, ClassificationResult]:
    _require_ok(intents)
    merged_style = _merge(
        style_result,
        [
            _Change(
                preferred=i.preferred_styles,
                inferred=i.inferred_preferred_styles,
                avoided=i.avoided_styles,
            )
            for i in intents
        ],
    )
    merged_color = _merge(
        color_result,
        [
            _Change(
                preferred=i.preferred_colors,
                inferred=i.inferred_preferred_colors,
                avoided=i.avoided_colors,
            )
            for i in intents
        ],
    )
    return merged_style, merged_color


# 반환값은 최저 체감온도에 더한다. lighter가 +라서 체감을 높게 보고 얇은 옷 쪽으로 간다
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


def formality_direction(intents: Sequence[RegenerationIntent]) -> FormalityDirection | None:
    _require_ok(intents)
    table = load_style_formality()
    direction: FormalityDirectionCd | None = None
    is_current = False
    for index, intent in enumerate(intents):
        signal = _formality_signal(intent, table)
        if signal is None:
            continue
        # 두 방향이 섞인 요청도 격식 요청으로 쳐서, 앞 요청의 방향을 이어 쓰지 않는다
        direction = None if signal == "mixed" else signal
        is_current = index == len(intents) - 1
    if direction is None:
        return None
    return FormalityDirection(direction, is_current)


@lru_cache
def load_style_formality(path: Path = STYLE_FORMALITY_PATH) -> StyleFormality:
    data = json.loads(path.read_text(encoding="utf-8"))
    table = StyleFormality(
        preferred=_load_signals(data, "preferred"), avoided=_load_signals(data, "avoided")
    )
    if not (
        table.avoided.less_formal <= table.preferred.more_formal
        and table.avoided.more_formal <= table.preferred.less_formal
    ):
        raise StyleFormalityConfigError("기피 신호는 선호 신호와 반대쪽 스타일이어야 합니다.")
    return table


def _load_signals(data: dict, section: str) -> FormalitySignals:
    try:
        less = frozenset(data[section]["less_formal"])
        more = frozenset(data[section]["more_formal"])
    except (KeyError, TypeError) as e:
        raise StyleFormalityConfigError(f"{section}: 설정 형식이 올바르지 않습니다.") from e
    unknown = sorted((less | more) - set(get_args(StyleCd)))
    if unknown:
        raise StyleFormalityConfigError(f"{section}: 알 수 없는 스타일 코드입니다: {unknown}")
    overlap = sorted(less & more)
    if overlap:
        raise StyleFormalityConfigError(
            f"{section}: 격식 쪽과 덜 격식 쪽에 함께 있는 스타일입니다: {overlap}"
        )
    return FormalitySignals(less_formal=less, more_formal=more)


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


# 선호 칸에 신호가 있으면 기피 칸은 보지 않는다. "스포티 말고 캐주얼하게"가 방향 없음이 되지 않게
def _formality_signal(
    intent: RegenerationIntent, table: StyleFormality
) -> FormalityDirectionCd | Literal["mixed"] | None:
    preferred = {*intent.preferred_styles, *intent.inferred_preferred_styles}
    signal = _signal(preferred, table.preferred)
    if signal is not None:
        return signal
    return _signal(set(intent.avoided_styles), table.avoided)


def _signal(
    styles: set[str], signals: FormalitySignals
) -> FormalityDirectionCd | Literal["mixed"] | None:
    less = styles & signals.less_formal
    more = styles & signals.more_formal
    if less and more:
        return "mixed"
    if less:
        return "less"
    if more:
        return "more"
    return None


def _merge(
    result: ClassificationResult,
    changes: Sequence[_Change],
) -> ClassificationResult:
    session_preferred: list[str] = []
    session_avoided: list[str] = []
    for preferred, inferred, avoided in changes:
        # 풀어서 채운 선호는 기피를 덮지 않는다 (FR-REF-08 예외)
        blocked = (
            set(session_avoided) | set(avoided) | (set(result.avoided) - set(session_preferred))
        )
        requested = list(dict.fromkeys([*preferred, *(v for v in inferred if v not in blocked)]))
        changed = set(requested) | set(avoided)
        session_preferred = [*requested, *(v for v in session_preferred if v not in changed)]
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
