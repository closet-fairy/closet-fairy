"""재추천 결과 저장 (#87, REF-05)."""

import logging
from collections.abc import Sequence
from typing import Literal

from app.core.db import AsyncSessionLocal
from app.repositories import recommendation_deck as deck_repo
from app.repositories import recommendation_session as session_repo
from app.repositories import regeneration_request as regeneration_repo
from app.services.essential_supplement import SupplementResult
from app.services.outfit_generator import DraftOutfit
from app.services.recommendation_save import insert_deck_outfits

logger = logging.getLogger(__name__)

DiscardReason = Literal["session_ended", "not_processing"]


class RegenerationDiscardedError(RuntimeError):
    """생성 결과를 저장하지 않고 버린다."""

    def __init__(self, reason: DiscardReason) -> None:
        super().__init__(reason)
        self.reason: DiscardReason = reason


async def save_regeneration_result(
    regeneration_request_id: int,
    recommendation_session_id: int,
    member_id: int,
    outfits: Sequence[DraftOutfit],
    supplement: SupplementResult,
) -> int:
    async with AsyncSessionLocal() as db, db.begin():
        session = await session_repo.lock_session(db, recommendation_session_id)
        if (
            session is None
            or session.settled_at is not None
            or session.session_status_cd != "active"
        ):
            raise RegenerationDiscardedError("session_ended")

        deck_seq = await deck_repo.next_deck_seq(db, recommendation_session_id)
        deck_id = await insert_deck_outfits(
            db,
            recommendation_session_id,
            deck_seq,
            "regeneration",
            member_id,
            outfits,
            supplement,
        )
        # result_deck_id를 같은 UPDATE로 넣으려고 덱을 먼저 넣는다.
        # processing이 아니면 예외로 덱까지 롤백한다
        if not await regeneration_repo.complete_request(db, regeneration_request_id, deck_id):
            raise RegenerationDiscardedError("not_processing")
    return deck_seq


async def mark_regeneration_failed(regeneration_request_id: int) -> bool | None:
    """새 DB 세션에서 processing인 요청만 failed로 바꾸고, 바꿨는지를 돌려준다.

    기록하다 실패하면 예외를 밖으로 던지지 않고 None을 돌려준다.
    """
    try:
        async with AsyncSessionLocal() as db, db.begin():
            return await regeneration_repo.fail_request(db, regeneration_request_id)
    except Exception:
        logger.exception(
            "재추천 실패 기록 실패",
            extra={"regeneration_request_id": regeneration_request_id},
        )
        return None
