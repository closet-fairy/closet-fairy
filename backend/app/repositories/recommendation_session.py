from dataclasses import dataclass
from datetime import datetime

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
    """
)


async def complete_generation(
    db: AsyncSession, recommendation_session_id: int, is_clothing_shortage: bool
) -> bool:
    """processing인 세션만 completed로 바꾸고, 바꿨는지를 돌려준다. commit은 호출자가 한다."""
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
class RatingSessionRow:
    member_id: int
    session_status_cd: str
    generation_status_cd: str
    settled_at: datetime | None


LOCK_SESSION_FOR_RATING_SQL = text(
    """
    SELECT member_id, session_status_cd, generation_status_cd, settled_at
    FROM recommendation_session
    WHERE recommendation_session_id = :recommendation_session_id
    FOR UPDATE
    """
)


async def lock_session_for_rating(
    db: AsyncSession, recommendation_session_id: int
) -> RatingSessionRow | None:
    result = await db.execute(
        LOCK_SESSION_FOR_RATING_SQL, {"recommendation_session_id": recommendation_session_id}
    )
    row = result.first()
    if row is None:
        return None
    return RatingSessionRow(
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
