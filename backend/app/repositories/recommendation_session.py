from dataclasses import dataclass
from datetime import datetime
from typing import Literal

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

INSERT_SQL = text(
    """
    INSERT INTO recommendation_session (
        member_id, sido_nm, sigungu_nm, location_input_type_cd,
        tpo_cd, tpo_text, tpo_input_type_cd,
        going_out_start_at, going_out_end_at, season_cd
    ) VALUES (
        :member_id, :sido_nm, :sigungu_nm, :location_input_type_cd,
        :tpo_cd, :tpo_text, :tpo_input_type_cd,
        :going_out_start_at, :going_out_end_at, :season_cd
    )
    """
)


async def insert_session(
    db: AsyncSession,
    *,
    member_id: int,
    sido_nm: str,
    sigungu_nm: str,
    location_input_type_cd: str,
    tpo_cd: str,
    tpo_text: str | None,
    tpo_input_type_cd: str,
    going_out_start_at: datetime,  # UTC, tzinfo 없음
    going_out_end_at: datetime,
    season_cd: str,
) -> int:
    result = await db.execute(
        INSERT_SQL,
        {
            "member_id": member_id,
            "sido_nm": sido_nm,
            "sigungu_nm": sigungu_nm,
            "location_input_type_cd": location_input_type_cd,
            "tpo_cd": tpo_cd,
            "tpo_text": tpo_text,
            "tpo_input_type_cd": tpo_input_type_cd,
            "going_out_start_at": going_out_start_at,
            "going_out_end_at": going_out_end_at,
            "season_cd": season_cd,
        },
    )
    await db.commit()
    return int(result.lastrowid)


@dataclass(frozen=True)
class SessionRow:
    member_id: int
    sido_nm: str
    sigungu_nm: str | None
    going_out_start_at: datetime
    going_out_end_at: datetime
    season_cd: str
    tpo_cd: str
    tpo_text: str | None
    tpo_input_type_cd: str


SELECT_SESSION_SQL = text(
    """
    SELECT member_id, sido_nm, sigungu_nm, going_out_start_at, going_out_end_at,
           season_cd, tpo_cd, tpo_text, tpo_input_type_cd
    FROM recommendation_session
    WHERE recommendation_session_id = :recommendation_session_id
    """
)


async def get_session(db: AsyncSession, recommendation_session_id: int) -> SessionRow | None:
    result = await db.execute(
        SELECT_SESSION_SQL, {"recommendation_session_id": recommendation_session_id}
    )
    row = result.first()
    if row is None:
        return None
    return SessionRow(
        member_id=row.member_id,
        sido_nm=row.sido_nm,
        sigungu_nm=row.sigungu_nm,
        going_out_start_at=row.going_out_start_at,
        going_out_end_at=row.going_out_end_at,
        season_cd=row.season_cd,
        tpo_cd=row.tpo_cd,
        tpo_text=row.tpo_text,
        tpo_input_type_cd=row.tpo_input_type_cd,
    )


COMPLETE_GENERATION_SQL = text(
    """
    UPDATE recommendation_session
    SET generation_status_cd = 'completed', is_clothing_shortage = :is_clothing_shortage
    WHERE recommendation_session_id = :recommendation_session_id
      AND generation_status_cd = 'processing'
      AND session_status_cd = 'active'
    """
)


async def complete_generation(
    db: AsyncSession, recommendation_session_id: int, is_clothing_shortage: bool
) -> bool:
    """processing인 세션만 completed로 바꾸고, 바꿨는지를 돌려준다. commit은 호출자가 한다.

    취소·이탈된 세션에는 저장하지 않는다.
    """
    result = await db.execute(
        COMPLETE_GENERATION_SQL,
        {
            "recommendation_session_id": recommendation_session_id,
            "is_clothing_shortage": is_clothing_shortage,
        },
    )
    return result.rowcount == 1


FAIL_GENERATION_SQL = text(
    """
    UPDATE recommendation_session
    SET generation_status_cd = 'failed'
    WHERE recommendation_session_id = :recommendation_session_id
      AND generation_status_cd = 'processing'
    """
)

FAIL_GENERATION_WITH_SHORTAGE_SQL = text(
    """
    UPDATE recommendation_session
    SET generation_status_cd = 'failed', is_clothing_shortage = :is_clothing_shortage
    WHERE recommendation_session_id = :recommendation_session_id
      AND generation_status_cd = 'processing'
    """
)


async def mark_generation_failed(
    db: AsyncSession,
    recommendation_session_id: int,
    is_clothing_shortage: bool | None = None,
) -> bool:
    """processing인 세션만 failed로 바꾸고, 바꿨는지를 돌려준다. commit은 호출자가 한다.

    is_clothing_shortage가 None이면 그 컬럼은 건드리지 않는다.
    """
    params: dict = {"recommendation_session_id": recommendation_session_id}
    if is_clothing_shortage is None:
        result = await db.execute(FAIL_GENERATION_SQL, params)
    else:
        params["is_clothing_shortage"] = is_clothing_shortage
        result = await db.execute(FAIL_GENERATION_WITH_SHORTAGE_SQL, params)
    return result.rowcount == 1


@dataclass(frozen=True)
class LockedSessionRow:
    member_id: int
    session_status_cd: str
    generation_status_cd: str
    settled_at: datetime | None


LOCK_SESSION_SQL = text(
    """
    SELECT member_id, session_status_cd, generation_status_cd, settled_at
    FROM recommendation_session
    WHERE recommendation_session_id = :recommendation_session_id
    FOR UPDATE
    """
)


async def lock_session(db: AsyncSession, recommendation_session_id: int) -> LockedSessionRow | None:
    result = await db.execute(
        LOCK_SESSION_SQL, {"recommendation_session_id": recommendation_session_id}
    )
    row = result.first()
    if row is None:
        return None
    return LockedSessionRow(
        member_id=row.member_id,
        session_status_cd=row.session_status_cd,
        generation_status_cd=row.generation_status_cd,
        settled_at=row.settled_at,
    )


COMPLETE_SETTLEMENT_SQL = text(
    """
    UPDATE recommendation_session
    SET settled_at = :settled_at, session_status_cd = 'completed', ended_at = :settled_at
    WHERE recommendation_session_id = :recommendation_session_id
      AND settled_at IS NULL
    """
)


async def complete_settlement(
    db: AsyncSession, recommendation_session_id: int, settled_at: datetime
) -> bool:
    """정산되지 않은 세션만 completed로 바꾸고, 바꿨는지를 돌려준다. commit은 호출자가 한다."""
    result = await db.execute(
        COMPLETE_SETTLEMENT_SQL,
        {"recommendation_session_id": recommendation_session_id, "settled_at": settled_at},
    )
    return result.rowcount == 1


EndedSessionStatusCd = Literal["canceled", "abandoned"]

END_SESSION_SQL = text(
    """
    UPDATE recommendation_session
    SET session_status_cd = :session_status_cd, ended_at = :ended_at,
        generation_status_cd = CASE WHEN generation_status_cd = 'processing'
                                    THEN 'failed' ELSE generation_status_cd END
    WHERE recommendation_session_id = :recommendation_session_id
      AND session_status_cd = 'active'
    """
)


async def end_session(
    db: AsyncSession,
    recommendation_session_id: int,
    session_status_cd: EndedSessionStatusCd,
    ended_at: datetime,
) -> bool:
    """active인 세션만 취소·이탈로 끝내고, 바꿨는지를 돌려준다. commit은 호출자가 한다.

    생성 중이던 세션은 failed로 끝낸다. 서버 재시작으로 파이프라인이 사라져도 processing이
    남지 않게 해서 폴링이 끝나도록 한다.
    """
    result = await db.execute(
        END_SESSION_SQL,
        {
            "recommendation_session_id": recommendation_session_id,
            "session_status_cd": session_status_cd,
            "ended_at": ended_at,
        },
    )
    return result.rowcount == 1


_HAS_ACTIVITY_SINCE = """
    (s.created_at >= :since
     OR EXISTS (SELECT 1 FROM recommendation_deck d
                WHERE d.recommendation_session_id = s.recommendation_session_id
                  AND d.created_at >= :since)
     OR EXISTS (SELECT 1 FROM regeneration_request r
                WHERE r.recommendation_session_id = s.recommendation_session_id
                  AND r.created_at >= :since))
"""

# s.created_at < :since는 활동 조건과 겹치지만 (session_status_cd, created_at) 인덱스를 타려고 둔다
FIND_INACTIVE_SESSION_IDS_SQL = text(
    f"""
    SELECT s.recommendation_session_id
    FROM recommendation_session s
    WHERE s.session_status_cd = 'active'
      AND s.created_at < :since
      AND NOT {_HAS_ACTIVITY_SINCE}
    ORDER BY s.recommendation_session_id
    """
)

HAS_ACTIVITY_SINCE_SQL = text(
    f"""
    SELECT {_HAS_ACTIVITY_SINCE} AS has_activity
    FROM recommendation_session s
    WHERE s.recommendation_session_id = :recommendation_session_id
    """
)


async def find_inactive_session_ids(db: AsyncSession, since: datetime) -> list[int]:
    result = await db.execute(FIND_INACTIVE_SESSION_IDS_SQL, {"since": since})
    return [int(r.recommendation_session_id) for r in result]


async def has_activity_since(
    db: AsyncSession, recommendation_session_id: int, since: datetime
) -> bool:
    result = await db.execute(
        HAS_ACTIVITY_SINCE_SQL,
        {"recommendation_session_id": recommendation_session_id, "since": since},
    )
    return bool(result.scalar_one())


FIND_SESSIONS_TO_CLEAN_SQL = text(
    """
    SELECT s.recommendation_session_id
    FROM recommendation_session s
    WHERE s.session_status_cd IN ('completed', 'canceled', 'abandoned')
      AND EXISTS (
        SELECT 1
        FROM recommendation_deck d
        LEFT JOIN outfit o ON o.recommendation_deck_id = d.recommendation_deck_id
        LEFT JOIN outfit_feedback f
          ON f.outfit_id = o.outfit_id AND f.feedback_type_cd = 'rated'
        WHERE d.recommendation_session_id = s.recommendation_session_id
          AND f.outfit_feedback_id IS NULL
      )
    ORDER BY s.recommendation_session_id
    """
)


async def find_sessions_to_clean(db: AsyncSession) -> list[int]:
    result = await db.execute(FIND_SESSIONS_TO_CLEAN_SQL)
    return [int(r.recommendation_session_id) for r in result]
