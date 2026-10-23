"""재추천 요청 기록 (#85). commit은 호출자가 한다."""

import json
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.regeneration_intent import RegenerationIntent

HAS_PROCESSING_REQUEST_SQL = text(
    """
    SELECT EXISTS (
        SELECT 1 FROM regeneration_request
        WHERE recommendation_session_id = :recommendation_session_id
          AND regeneration_status_cd = 'processing'
          AND created_at >= :stale_before
    ) AS has_processing
    """
)

FAIL_STALE_PROCESSING_SQL = text(
    """
    UPDATE regeneration_request
    SET regeneration_status_cd = 'failed'
    WHERE recommendation_session_id = :recommendation_session_id
      AND regeneration_status_cd = 'processing'
      AND created_at < :stale_before
    """
)

NEXT_REQUEST_SEQ_SQL = text(
    """
    SELECT COALESCE(MAX(request_seq), 0) + 1 AS next_seq
    FROM regeneration_request
    WHERE recommendation_session_id = :recommendation_session_id
    """
)

INSERT_SQL = text(
    """
    INSERT INTO regeneration_request (
        recommendation_session_id, request_seq, target_scope_cd, target_outfit_id,
        target_slot_cd, request_text, parsed_intent
    ) VALUES (
        :recommendation_session_id, :request_seq, :target_scope_cd, :target_outfit_id,
        :target_slot_cd, :request_text, :parsed_intent
    )
    """
)


async def has_processing_request(
    db: AsyncSession, recommendation_session_id: int, stale_before: datetime
) -> bool:
    result = await db.execute(
        HAS_PROCESSING_REQUEST_SQL,
        {"recommendation_session_id": recommendation_session_id, "stale_before": stale_before},
    )
    return bool(result.scalar_one())


async def fail_stale_processing(
    db: AsyncSession, recommendation_session_id: int, stale_before: datetime
) -> int:
    result = await db.execute(
        FAIL_STALE_PROCESSING_SQL,
        {"recommendation_session_id": recommendation_session_id, "stale_before": stale_before},
    )
    return result.rowcount


async def next_request_seq(db: AsyncSession, recommendation_session_id: int) -> int:
    result = await db.execute(
        NEXT_REQUEST_SEQ_SQL, {"recommendation_session_id": recommendation_session_id}
    )
    return int(result.scalar_one())


async def insert_request(
    db: AsyncSession,
    *,
    recommendation_session_id: int,
    request_seq: int,
    target_scope_cd: str,
    target_outfit_id: int | None,
    target_slot_cd: str | None,
    request_text: str,
    parsed_intent: str,
) -> int:
    result = await db.execute(
        INSERT_SQL,
        {
            "recommendation_session_id": recommendation_session_id,
            "request_seq": request_seq,
            "target_scope_cd": target_scope_cd,
            "target_outfit_id": target_outfit_id,
            "target_slot_cd": target_slot_cd,
            "request_text": request_text,
            "parsed_intent": parsed_intent,
        },
    )
    return int(result.lastrowid)


@dataclass(frozen=True)
class RegenerationRequestRow:
    regeneration_request_id: int
    recommendation_session_id: int
    request_seq: int
    target_scope_cd: str
    target_outfit_id: int | None
    target_slot_cd: str | None
    parsed_intent: RegenerationIntent
    regeneration_status_cd: str


SELECT_REQUEST_SQL = text(
    """
    SELECT regeneration_request_id, recommendation_session_id, request_seq, target_scope_cd,
           target_outfit_id, target_slot_cd, parsed_intent, regeneration_status_cd
    FROM regeneration_request
    WHERE regeneration_request_id = :regeneration_request_id
    """
)

SELECT_COMPLETED_INTENTS_SQL = text(
    """
    SELECT parsed_intent
    FROM regeneration_request
    WHERE recommendation_session_id = :recommendation_session_id
      AND request_seq < :before_seq
      AND regeneration_status_cd = 'completed'
    ORDER BY request_seq
    """
)


async def get_request(
    db: AsyncSession, regeneration_request_id: int
) -> RegenerationRequestRow | None:
    row = (
        await db.execute(SELECT_REQUEST_SQL, {"regeneration_request_id": regeneration_request_id})
    ).first()
    if row is None:
        return None
    return RegenerationRequestRow(
        regeneration_request_id=row.regeneration_request_id,
        recommendation_session_id=row.recommendation_session_id,
        request_seq=row.request_seq,
        target_scope_cd=row.target_scope_cd,
        target_outfit_id=row.target_outfit_id,
        target_slot_cd=row.target_slot_cd,
        parsed_intent=_to_intent(row.parsed_intent),
        regeneration_status_cd=row.regeneration_status_cd,
    )


async def find_completed_intents(
    db: AsyncSession, recommendation_session_id: int, before_seq: int
) -> list[RegenerationIntent]:
    result = await db.execute(
        SELECT_COMPLETED_INTENTS_SQL,
        {"recommendation_session_id": recommendation_session_id, "before_seq": before_seq},
    )
    return [_to_intent(r.parsed_intent) for r in result]


def _to_intent(parsed_intent: str | dict) -> RegenerationIntent:
    data = json.loads(parsed_intent) if isinstance(parsed_intent, str) else parsed_intent
    return RegenerationIntent.from_dict(data)
