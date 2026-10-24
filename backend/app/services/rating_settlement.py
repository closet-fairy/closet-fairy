"""별점 부여 + 세션 종료 일괄 정산 (REC-18).

별점 1건을 받으면 세션의 모든 덱·코디에 피드백을 일괄 생성하고, 속성 단위로 겹침 규칙을
적용해 선호 점수를 갱신한 뒤 세션을 종료한다. 모두 한 트랜잭션이며, 잠금 순서는 항상
세션 행 → preference_score다.
"""

import logging
from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.core.errors import ConflictError
from app.core.logging import Event
from app.repositories import outfit_feedback as feedback_repo
from app.repositories import preference_score as score_repo
from app.repositories import recommendation_deck as deck_repo
from app.repositories import recommendation_session as session_repo
from app.repositories import regeneration_request as regeneration_repo
from app.repositories.outfit_feedback import AttributeFeedback, FeedbackRow
from app.repositories.preference_score import ScoreRow, ScoreUpdate
from app.repositories.recommendation_deck import SessionOutfit
from app.repositories.regeneration_request import RequestTargetRow
from app.services.preference_score import decay_ema, update_ema
from app.services.recommendation_session import to_db_utc
from app.services.session_cleanup import cleanup_ended_session
from app.services.session_errors import (
    OutfitNotInSessionError,
    SessionAlreadySettledError,
    SessionNotFoundError,
)

logger = logging.getLogger(__name__)

AttributeKey = tuple[str, str]

MYSQL_DUPLICATE_ENTRY = 1062


class SessionNotRatableError(ConflictError):
    code = "SESSION_NOT_RATABLE"
    message = "별점을 매길 수 없는 세션입니다."


@dataclass(frozen=True)
class SettlementSummary:
    outfit_count: int
    exposed_attribute_count: int
    updated_row_count: int
    rated_delta: Decimal
    regeneration_requested_count: int


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
        # 부호가 아니라 유형으로 판정한다.
        # 별점 2점은 델타가 0이라 부호로 보면 거절(-0.1)에 밀려 음수가 된다
        if row.feedback_type_cd == "rated":
            rated[key] = row.applied_delta
        else:
            others[key] = min(others.get(key, row.applied_delta), row.applied_delta)
    return {**others, **rated}


def regeneration_target_outfit_ids(
    outfits: Sequence[SessionOutfit], requests: Sequence[RequestTargetRow]
) -> set[int]:
    targets: set[int] = set()
    for request in requests:
        if request.target_scope_cd == "single":
            if request.target_outfit_id is not None:
                targets.add(request.target_outfit_id)
            continue
        # created_at은 초 단위라 같은 시각이 생길 수 있어, 결과 덱으로 그 요청 시점 화면을 되짚는다
        later_deck_ids = {
            r.result_deck_id
            for r in requests
            if r.request_seq >= request.request_seq and r.result_deck_id is not None
        }
        targets |= _latest_outfit_ids(
            o for o in outfits if o.recommendation_deck_id not in later_deck_ids
        )
    return targets


def _latest_outfit_ids(outfits: Iterable[SessionOutfit]) -> set[int]:
    latest: dict[int, SessionOutfit] = {}
    for outfit in outfits:
        current = latest.get(outfit.outfit_seq)
        if current is None or outfit.deck_seq > current.deck_seq:
            latest[outfit.outfit_seq] = outfit
    return {o.outfit_id for o in latest.values()}


def plan_score_updates(
    rows: Sequence[ScoreRow], deltas: Mapping[AttributeKey, Decimal], settings: Settings
) -> list[ScoreUpdate]:
    updates = []
    for row in rows:
        delta = deltas.get((row.attribute_type_cd, row.attribute_value))
        if delta is None:
            s, n = decay_ema(row.score_sum, row.exposure_count, settings)
        else:
            s, n = update_ema(row.score_sum, row.exposure_count, delta, settings)
        if s == row.score_sum and n == row.exposure_count:
            continue
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
            summary = await _rate_and_settle(
                db, recommendation_session_id, member_id, outfit_id, rating, now
            )
    except IntegrityError as e:
        if _is_duplicate_entry(e):
            raise SessionAlreadySettledError() from e
        raise

    logger.info(
        "세션 정산 완료",
        extra={
            "event": Event.PREFERENCE_SETTLED,
            "recommendation_session_id": recommendation_session_id,
            "outfit_count": summary.outfit_count,
            "exposed_attribute_count": summary.exposed_attribute_count,
            "updated_row_count": summary.updated_row_count,
            "rated_delta": summary.rated_delta,
            "regeneration_requested_count": summary.regeneration_requested_count,
        },
    )

    # 정산 트랜잭션과 잠금 시간을 늘리지 않으려고 commit 뒤 별도 트랜잭션에서 정리한다
    try:
        await cleanup_ended_session(db, recommendation_session_id)
    except Exception:
        logger.warning(
            "정산 후 세션 정리 실패. 이탈 배치가 다시 정리한다",
            exc_info=True,
            extra={"recommendation_session_id": recommendation_session_id},
        )


async def _rate_and_settle(
    db: AsyncSession,
    recommendation_session_id: int,
    member_id: int,
    outfit_id: int,
    rating: int,
    now: datetime,
) -> SettlementSummary:
    settings = get_settings()

    session = await session_repo.lock_session(db, recommendation_session_id)
    if session is None or session.member_id != member_id:
        raise SessionNotFoundError()
    if session.settled_at is not None:
        raise SessionAlreadySettledError()
    if session.session_status_cd != "active" or session.generation_status_cd != "completed":
        raise SessionNotRatableError()

    outfits = await deck_repo.find_session_outfits(db, recommendation_session_id)
    outfit_ids = [o.outfit_id for o in outfits]
    if outfit_id not in outfit_ids:
        raise OutfitNotInSessionError()

    requests = await regeneration_repo.find_session_requests(db, recommendation_session_id)
    regeneration_targets = regeneration_target_outfit_ids(outfits, requests)

    rated_delta = rating_delta(rating, settings)
    feedbacks = [
        _feedback_row(oid, outfit_id, rating, rated_delta, regeneration_targets, settings)
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

    return SettlementSummary(
        outfit_count=len(outfit_ids),
        exposed_attribute_count=len(deltas),
        updated_row_count=len(updates),
        rated_delta=rated_delta,
        regeneration_requested_count=sum(
            f.feedback_type_cd == "regeneration_requested" for f in feedbacks
        ),
    )


def _feedback_row(
    oid: int,
    rated_outfit_id: int,
    rating: int,
    rated_delta: Decimal,
    regeneration_targets: set[int],
    settings: Settings,
) -> FeedbackRow:
    if oid == rated_outfit_id:
        return FeedbackRow(oid, "rated", rating, rated_delta)
    if oid in regeneration_targets:
        return FeedbackRow(
            oid, "regeneration_requested", None, settings.SCORE_DELTA_REGENERATION_REQUESTED
        )
    return FeedbackRow(oid, "auto_rejected", None, settings.SCORE_DELTA_AUTO_REJECTED)


def _is_duplicate_entry(error: IntegrityError) -> bool:
    args = getattr(error.orig, "args", ())
    return bool(args) and args[0] == MYSQL_DUPLICATE_ENTRY
