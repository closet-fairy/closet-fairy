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


SELECT_SESSION_SQL = text(
    """
    SELECT member_id, sido_nm, sigungu_nm, going_out_start_at, going_out_end_at, season_cd
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
    )
