"""선호도 계산 · 분류 · UCB 탐색 스타일 선정. DB에 의존하지 않는 순수 함수만 둔다."""

import logging
import math
import random
from collections.abc import Sequence
from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal
from itertools import groupby
from typing import Literal

from app.core.config import Settings
from app.core.logging import Event
from app.repositories.preference_score import PreferenceRow

logger = logging.getLogger(__name__)

AttributeType = Literal["style", "color"]

PREFERENCE_QUANTUM = Decimal("0.0001")
UCB_QUANTUM = Decimal("0.0001")
INFINITE_UCB = Decimal("Infinity")


@dataclass(frozen=True)
class ClassificationResult:
    attribute_type: AttributeType
    preference_injected: bool
    avoided: list[str]
    preferred: list[str]
    low_preferred: list[str]
    neutral: list[str]
    preference_by_value: dict[str, Decimal]


def update_ema(
    score_sum: Decimal, exposure_count: Decimal, delta: Decimal, settings: Settings
) -> tuple[Decimal, Decimal]:
    alpha = settings.PREFERENCE_SCORE_EMA_ALPHA
    quantum = Decimal(1).scaleb(-settings.PREFERENCE_SCORE_DECIMAL_PLACES)

    # Decimal 기본 반올림은 HALF_EVEN이라, MySQL ROUND()와 맞추려면 HALF_UP을 명시해야 한다
    new_score = (alpha * score_sum + delta).quantize(quantum, rounding=ROUND_HALF_UP)
    new_count = (alpha * exposure_count + 1).quantize(quantum, rounding=ROUND_HALF_UP)

    if abs(new_score) < settings.PREFERENCE_SCORE_ZERO_EPSILON:
        new_score = Decimal(0)
    new_score = min(max(new_score, settings.PREFERENCE_SCORE_MIN), settings.PREFERENCE_SCORE_MAX)

    return new_score.quantize(quantum, rounding=ROUND_HALF_UP), new_count


def compute_preference(score_sum: Decimal, exposure_count: Decimal, settings: Settings) -> Decimal:
    p = score_sum / (exposure_count + settings.PREFERENCE_SCORE_PRIOR_WEIGHT)
    return p.quantize(PREFERENCE_QUANTUM, rounding=ROUND_HALF_UP)


def classify(
    attribute_type: AttributeType, rows: Sequence[PreferenceRow], settings: Settings
) -> ClassificationResult:
    preference = {
        row.attribute_value: compute_preference(row.score_sum, row.exposure_count, settings)
        for row in rows
    }
    display_seq = {row.attribute_value: row.display_seq for row in rows}

    def ordered(values: list[str]) -> list[str]:
        return sorted(values, key=lambda v: (-preference[v], display_seq[v]))

    avoided = _pick_avoided(rows, preference, settings)
    remaining = [row.attribute_value for row in rows if row.attribute_value not in avoided]
    distinct_desc = sorted({preference[v] for v in remaining}, reverse=True)

    if len(distinct_desc) <= 1:
        return ClassificationResult(
            attribute_type=attribute_type,
            preference_injected=False,
            avoided=ordered(list(avoided)),
            preferred=[],
            low_preferred=[],
            neutral=ordered(remaining),
            preference_by_value=preference,
        )

    k = math.ceil(len(remaining) * settings.PREFERRED_TOP_RATIO)
    boundary = sorted((preference[v] for v in remaining), reverse=True)[k - 1]
    # 경계 동점 묶음이 최하위 묶음이면 선호에서 제외한다. 구분 정보가 없는 묶음을 선호로
    # 보지 않는다는 점에서 '전부 동점이면 미주입'과 같은 원칙이다. 그래서 선호 수가 k보다
    # 적어질 수 있고, 그게 의도한 동작이다.
    if boundary == distinct_desc[-1]:
        preferred = [v for v in remaining if preference[v] > boundary]
    else:
        preferred = [v for v in remaining if preference[v] >= boundary]
    low_preferred = [v for v in remaining if v not in preferred]

    return ClassificationResult(
        attribute_type=attribute_type,
        preference_injected=True,
        avoided=ordered(list(avoided)),
        preferred=ordered(preferred),
        low_preferred=ordered(low_preferred),
        neutral=[],
        preference_by_value=preference,
    )


def _pick_avoided(
    rows: Sequence[PreferenceRow], preference: dict[str, Decimal], settings: Settings
) -> set[str]:
    limit = math.floor(len(rows) * settings.DISLIKE_BOTTOM_RATIO)
    candidates = sorted(
        (
            row.attribute_value
            for row in rows
            if preference[row.attribute_value] < 0
            and row.exposure_count >= settings.DISLIKE_MIN_FEEDBACK_COUNT
        ),
        key=lambda v: preference[v],
    )

    avoided: set[str] = set()
    for _, group in groupby(candidates, key=lambda v: preference[v]):
        tied = list(group)
        # 가장 낮은 동점 묶음은 한도를 넘어도 통째로 기피에 넣는다. 스타일이 여러 개 태깅된
        # 옷은 그 스타일들의 S·N이 똑같이 쌓여 최하위가 동점이 되기 쉬운데, 이때 멈추면
        # 기피가 비어 버린다.
        if avoided and len(avoided) + len(tied) > limit:
            break
        avoided.update(tied)
    return avoided


def select_exploration_style(
    style_result: ClassificationResult,
    rows: Sequence[PreferenceRow],
    n_sessions: int,
    settings: Settings,
    rng: random.Random,
) -> str | None:
    excluded = set(style_result.avoided) | set(style_result.preferred)
    candidates = [row for row in rows if row.attribute_value not in excluded]

    if not candidates:
        logger.info(
            "탐색 스타일 후보 없음",
            extra={
                "event": Event.UCB_EXPLORE_PICK,
                "style_cd": None,
                "candidate_count": 0,
                "n_sessions": n_sessions,
            },
        )
        return None

    log_sessions = Decimal(max(n_sessions, 2)).ln()

    def ucb(row: PreferenceRow) -> Decimal:
        if row.exposure_count == 0:
            return INFINITE_UCB
        bonus = settings.EXPLORATION_UCB_COEFFICIENT * (log_sessions / row.exposure_count).sqrt()
        value = style_result.preference_by_value[row.attribute_value] + bonus
        return value.quantize(UCB_QUANTUM, rounding=ROUND_HALF_UP)

    scores = {row.attribute_value: ucb(row) for row in candidates}
    best = max(scores.values())
    tied = sorted(
        (row for row in candidates if scores[row.attribute_value] == best),
        key=lambda row: row.display_seq,
    )
    picked = rng.choice(tied).attribute_value

    logger.info(
        "탐색 스타일 선정",
        extra={
            "event": Event.UCB_EXPLORE_PICK,
            "style_cd": picked,
            "ucb": best,
            "candidate_count": len(candidates),
            "tie_count": len(tied),
            "n_sessions": n_sessions,
        },
    )
    return picked
