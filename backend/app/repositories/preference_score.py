from decimal import Decimal
from typing import NamedTuple

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


class PreferenceRow(NamedTuple):
    attribute_value: str
    score_sum: Decimal
    exposure_count: Decimal
    display_seq: int


SELECT_SCORES_SQL = text(
    """
    SELECT ps.attribute_type_cd, ps.attribute_value, ps.score_sum, ps.exposure_count,
           COALESCE(s.display_seq, c.display_seq) AS display_seq
    FROM preference_score ps
    LEFT JOIN style s ON ps.attribute_type_cd = 'style' AND s.style_cd = ps.attribute_value
    LEFT JOIN color c ON ps.attribute_type_cd = 'color' AND c.color_cd = ps.attribute_value
    WHERE ps.member_id = :member_id
      AND (s.style_id IS NOT NULL OR c.color_id IS NOT NULL)
    ORDER BY ps.attribute_type_cd, display_seq
    """
)

COUNT_SETTLED_SESSIONS_SQL = text(
    """
    SELECT COUNT(*)
    FROM recommendation_session
    WHERE member_id = :member_id AND settled_at IS NOT NULL
    """
)


async def find_preference_scores(
    db: AsyncSession, member_id: int
) -> dict[str, list[PreferenceRow]]:
    result = await db.execute(SELECT_SCORES_SQL, {"member_id": member_id})
    rows: dict[str, list[PreferenceRow]] = {"style": [], "color": []}
    for r in result:
        rows[r.attribute_type_cd].append(
            PreferenceRow(r.attribute_value, r.score_sum, r.exposure_count, r.display_seq)
        )
    return rows


async def count_settled_sessions(db: AsyncSession, member_id: int) -> int:
    result = await db.execute(COUNT_SETTLED_SESSIONS_SQL, {"member_id": member_id})
    return int(result.scalar_one())
