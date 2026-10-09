"""이탈 세션 판정 + 세션 정리 배치. 스케줄러 연결 전까지는 수동 실행.
실행: python -m app.workers.session_abandon_batch"""

import asyncio
import logging
from datetime import datetime, timedelta

from app.core.config import get_settings
from app.core.db import AsyncSessionLocal, engine
from app.core.logging import setup_logging
from app.repositories import recommendation_session as session_repo
from app.services.recommendation_session import to_db_utc
from app.services.session_cleanup import NOTHING_DELETED, cleanup_ended_session
from app.services.session_end import abandon_if_inactive
from app.services.weather.base_time import KST

logger = logging.getLogger(__name__)


async def run(now: datetime) -> dict[str, int]:
    since = to_db_utc(now) - timedelta(minutes=get_settings().SESSION_ABANDON_TIMEOUT_MINUTES)
    result = {"abandoned": 0, "cleaned": 0, "failed": 0}

    async with AsyncSessionLocal() as db:
        inactive_ids = await session_repo.find_inactive_session_ids(db, since)
    for session_id in inactive_ids:
        try:
            async with AsyncSessionLocal() as db:
                if await abandon_if_inactive(db, session_id, since, now):
                    result["abandoned"] += 1
        except Exception:
            logger.exception("이탈 처리 실패", extra={"recommendation_session_id": session_id})
            result["failed"] += 1

    async with AsyncSessionLocal() as db:
        to_clean_ids = await session_repo.find_sessions_to_clean(db)
    for session_id in to_clean_ids:
        try:
            async with AsyncSessionLocal() as db:
                if await cleanup_ended_session(db, session_id) != NOTHING_DELETED:
                    result["cleaned"] += 1
        except Exception:
            logger.exception("세션 정리 실패", extra={"recommendation_session_id": session_id})
            result["failed"] += 1

    return result


async def main() -> None:
    setup_logging()
    result = await run(datetime.now(KST))
    await engine.dispose()
    print(result)


if __name__ == "__main__":
    asyncio.run(main())
