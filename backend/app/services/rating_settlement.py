"""별점 부여 + 세션 종료 일괄 정산 (REC-18).

별점 1건을 받으면 세션의 모든 덱·코디에 피드백을 일괄 생성하고, 속성 단위로 겹침 규칙을
적용해 선호 점수를 갱신한 뒤 세션을 종료한다. 모두 한 트랜잭션이며, 잠금 순서는 항상
세션 행 → preference_score다.
"""

import logging
from collections.abc import Iterable, Mapping, Sequence
from datetime import datetime
from decimal import Decimal

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.core.errors import ConflictError, NotFoundError
from app.core.logging import Event
from app.repositories import outfit_feedback as feedback_repo
from app.repositories import preference_score as score_repo
from app.repositories import recommendation_deck as deck_repo
from app.repositories import recommendation_session as session_repo
from app.repositories.outfit_feedback import AttributeFeedback, FeedbackRow
from app.repositories.preference_score import ScoreRow, ScoreUpdate
from app.services.preference_score import update_ema
from app.services.recommendation_session import to_db_utc

logger = logging.getLogger(__name__)

AttributeKey = tuple[str, str]

MYSQL_DUPLICATE_ENTRY = 1062


class SessionNotFoundError(NotFoundError):
    code = "SESSION_NOT_FOUND"
    message = "추천 세션을 찾을 수 없습니다."


class OutfitNotInSessionError(NotFoundError):
    code = "OUTFIT_NOT_FOUND"
    message = "이 세션에서 추천한 코디가 아닙니다."


class SessionAlreadySettledError(ConflictError):
    code = "SESSION_ALREADY_SETTLED"
    message = "이미 별점을 매긴 세션입니다."


class SessionNotRatableError(ConflictError):
    code = "SESSION_NOT_RATABLE"
    message = "별점을 매길 수 없는 세션입니다."


def rating_delta(rating: int, settings: Settings) -> Decimal:
    deltas = {
        1: settings.SCORE_DELTA_RATING_1,
        2: settings.SCORE_DELTA_RATING_2,
        3: settings.SCORE_DELTA_RATING_3,
        4: settings.SCORE_DELTA_RATING_4,
        5: settings.SCORE_DELTA_RATING_5,
    }
    return deltas[rating]


def resolve_attribute_deltas(rows: Iterable[AttributeFeedback]) -> dict[AttributeKey, Decimal]:
    rated: dict[AttributeKey, Decimal] = {}
    others: dict[AttributeKey, Decimal] = {}
    for row in rows:
        key = (row.attribute_type_cd, row.attribute_value)
        if row.feedback_type_cd == "rated":
            rated[key] = row.applied_delta
        else:
            others[key] = min(others.get(key, row.applied_delta), row.applied_delta)
    return {**others, **rated}


def plan_score_updates(
    rows: Sequence[ScoreRow], deltas: Mapping[AttributeKey, Decimal], settings: Settings
) -> list[ScoreUpdate]:
    updates = []
    for row in rows:
        delta = deltas.get((row.attribute_type_cd, row.attribute_value))
        if delta is None:
            continue
        s, n = update_ema(row.score_sum, row.exposure_count, delta, settings)
        updates.append(ScoreUpdate(row.preference_score_id, s, n))
    return updates


async def rate_and_settle(
    db: AsyncSession,
    recommendation_session_id: int,
    member_id: int,
    outfit_id: int,
    rating: int,
    now: datetime,
) -> None:
    try:
        async with db.begin():
            await _rate_and_settle(db, recommendation_session_id, member_id, outfit_id, rating, now)
    except IntegrityError as e:
        if _is_duplicate_entry(e):
            raise SessionAlreadySettledError() from e
        raise


async def _rate_and_settle(
    db: AsyncSession,
    recommendation_session_id: int,
    member_id: int,
    outfit_id: int,
    rating: int,
    now: datetime,
) -> None:
    settings = get_settings()

    session = await session_repo.lock_session_for_rating(db, recommendation_session_id)
    if session is None or session.member_id != member_id:
        raise SessionNotFoundError()
    if session.settled_at is not None:
        raise SessionAlreadySettledError()
    if session.session_status_cd != "active" or session.generation_status_cd != "completed":
        raise SessionNotRatableError()

    outfit_ids = await deck_repo.find_session_outfit_ids(db, recommendation_session_id)
    if outfit_id not in outfit_ids:
        raise OutfitNotInSessionError()

    rated_delta = rating_delta(rating, settings)
    feedbacks = [
        FeedbackRow(oid, "rated", rating, rated_delta)
        if oid == outfit_id
        else FeedbackRow(oid, "auto_rejected", None, settings.SCORE_DELTA_AUTO_REJECTED)
        for oid in outfit_ids
    ]
    await feedback_repo.insert_feedbacks(db, recommendation_session_id, feedbacks)

    attribute_feedbacks = await feedback_repo.find_session_attribute_feedbacks(
        db, recommendation_session_id
    )
    deltas = resolve_attribute_deltas(attribute_feedbacks)

    scores = await score_repo.lock_member_scores(db, member_id)
    missing = set(deltas) - {(r.attribute_type_cd, r.attribute_value) for r in scores}
    if missing:
        logger.warning(
            "선호 점수 행이 없는 속성은 정산에서 건너뜀",
            extra={
                "recommendation_session_id": recommendation_session_id,
                "missing_attributes": sorted(f"{t}:{v}" for t, v in missing),
            },
        )
    updates = plan_score_updates(scores, deltas, settings)
    await score_repo.update_scores(db, updates)

    if not await session_repo.complete_settlement(db, recommendation_session_id, to_db_utc(now)):
        raise SessionAlreadySettledError()

    logger.info(
        "세션 정산 완료",
        extra={
            "event": Event.PREFERENCE_SETTLED,
            "recommendation_session_id": recommendation_session_id,
            "outfit_count": len(outfit_ids),
            "exposed_attribute_count": len(deltas),
            "updated_row_count": len(updates),
            "rated_delta": rated_delta,
        },
    )


def _is_duplicate_entry(error: IntegrityError) -> bool:
    args = getattr(error.orig, "args", ())
    return bool(args) and args[0] == MYSQL_DUPLICATE_ENTRY
