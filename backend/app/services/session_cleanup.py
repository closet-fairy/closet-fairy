"""세션 산출물 정리 (#32, 컨벤션 5-1).

별점을 받은 세션은 별점 코디만 남기고 나머지 코디와 빈 덱을 지운다. 취소·이탈 세션은 덱을 모두
지운다. 세션 행과 weather_snapshot은 상태 기록으로 남긴다.
"""

import logging
from dataclasses import dataclass

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import Event
from app.repositories import outfit_feedback as feedback_repo
from app.repositories import recommendation_deck as deck_repo
from app.repositories import recommendation_session as session_repo

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class CleanupResult:
    deleted_outfit_count: int
    deleted_deck_count: int


NOTHING_DELETED = CleanupResult(0, 0)


async def cleanup_locked_session(
    db: AsyncSession, recommendation_session_id: int, session_status_cd: str
) -> CleanupResult:
    if session_status_cd == "completed":
        rated_outfit_id = await feedback_repo.find_rated_outfit_id(db, recommendation_session_id)
        if rated_outfit_id is None:
            logger.warning(
                "별점 코디가 없는 완료 세션은 정리하지 않음",
                extra={"recommendation_session_id": recommendation_session_id},
            )
            return NOTHING_DELETED
        outfit_count = await deck_repo.delete_outfits_except(
            db, recommendation_session_id, rated_outfit_id
        )
        deck_count = await deck_repo.delete_empty_decks(db, recommendation_session_id)
        return CleanupResult(outfit_count, deck_count)

    if session_status_cd in ("canceled", "abandoned"):
        outfit_ids = await deck_repo.find_session_outfit_ids(db, recommendation_session_id)
        deck_count = await deck_repo.delete_session_decks(db, recommendation_session_id)
        return CleanupResult(len(outfit_ids), deck_count)

    return NOTHING_DELETED


async def cleanup_ended_session(db: AsyncSession, recommendation_session_id: int) -> CleanupResult:
    async with db.begin():
        session = await session_repo.lock_session(db, recommendation_session_id)
        if session is None:
            return NOTHING_DELETED
        result = await cleanup_locked_session(
            db, recommendation_session_id, session.session_status_cd
        )

    _log_cleaned(recommendation_session_id, result)
    return result


def _log_cleaned(recommendation_session_id: int, result: CleanupResult) -> None:
    if result == NOTHING_DELETED:
        return
    logger.info(
        "세션 산출물 정리",
        extra={
            "event": Event.SESSION_CLEANED,
            "recommendation_session_id": recommendation_session_id,
            "deleted_outfit_count": result.deleted_outfit_count,
            "deleted_deck_count": result.deleted_deck_count,
        },
    )
