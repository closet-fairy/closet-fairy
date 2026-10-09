"""세션 취소·이탈 (#32, FR-REF-20).

둘 다 점수를 반영하지 않고 세션의 덱을 모두 지운다. 잠금 순서는 정산과 같이 세션 행이 먼저이고,
잠근 뒤에 상태를 다시 확인한다.
"""

import logging
from datetime import datetime
from typing import Literal

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.logging import Event
from app.repositories import recommendation_session as session_repo
from app.services.rating_settlement import SessionAlreadySettledError, SessionNotFoundError
from app.services.recommendation_session import to_db_utc
from app.services.session_cleanup import cleanup_locked_session

logger = logging.getLogger(__name__)

CanceledStatusCd = Literal["canceled", "abandoned"]


async def cancel_session(
    db: AsyncSession, recommendation_session_id: int, member_id: int, now: datetime
) -> CanceledStatusCd:
    async with db.begin():
        session = await session_repo.lock_session(db, recommendation_session_id)
        if session is None or session.member_id != member_id:
            raise SessionNotFoundError()
        if session.settled_at is not None or session.session_status_cd == "completed":
            raise SessionAlreadySettledError()
        if session.session_status_cd != "active":
            return session.session_status_cd

        await session_repo.end_session(db, recommendation_session_id, "canceled", to_db_utc(now))
        cleanup = await cleanup_locked_session(db, recommendation_session_id, "canceled")

    logger.info(
        "세션 취소",
        extra={
            "event": Event.SESSION_CANCELED,
            "recommendation_session_id": recommendation_session_id,
            "deleted_deck_count": cleanup.deleted_deck_count,
        },
    )
    return "canceled"


async def abandon_if_inactive(
    db: AsyncSession, recommendation_session_id: int, since: datetime, now: datetime
) -> bool:
    async with db.begin():
        session = await session_repo.lock_session(db, recommendation_session_id)
        if session is None or session.session_status_cd != "active":
            return False
        if await session_repo.has_activity_since(db, recommendation_session_id, since):
            return False

        await session_repo.end_session(db, recommendation_session_id, "abandoned", to_db_utc(now))
        cleanup = await cleanup_locked_session(db, recommendation_session_id, "abandoned")

    logger.info(
        "세션 이탈 처리",
        extra={
            "event": Event.SESSION_ABANDONED,
            "recommendation_session_id": recommendation_session_id,
            "deleted_deck_count": cleanup.deleted_deck_count,
        },
    )
    return True
