"""코디 피드백 저장과 정산용 속성 집계 원본 조회 (REC-18). commit은 호출자가 한다."""

from collections.abc import Sequence
from dataclasses import dataclass
from decimal import Decimal

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


@dataclass(frozen=True)
class FeedbackRow:
    outfit_id: int
    feedback_type_cd: str
    rating: int | None
    applied_delta: Decimal


@dataclass(frozen=True)
class AttributeFeedback:
    attribute_type_cd: str
    attribute_value: str
    feedback_type_cd: str
    applied_delta: Decimal


INSERT_FEEDBACK_SQL = text(
    """
    INSERT INTO outfit_feedback (
        outfit_id, recommendation_session_id, feedback_type_cd, rating, applied_delta
    ) VALUES (
        :outfit_id, :recommendation_session_id, :feedback_type_cd, :rating, :applied_delta
    )
    """
)

SELECT_ATTRIBUTE_FEEDBACKS_SQL = text(
    """
    SELECT 'style' AS attribute_type_cd, cs.style_cd AS attribute_value,
           f.feedback_type_cd, f.applied_delta
    FROM outfit_feedback f
    JOIN outfit_item oi    ON oi.outfit_id = f.outfit_id AND oi.item_source_cd = 'owned'
    JOIN clothing_style cs ON cs.clothing_id = oi.clothing_id
    WHERE f.recommendation_session_id = :recommendation_session_id
    UNION ALL
    SELECT 'color', c.color_cd, f.feedback_type_cd, f.applied_delta
    FROM outfit_feedback f
    JOIN outfit_item oi ON oi.outfit_id = f.outfit_id AND oi.item_source_cd = 'owned'
    JOIN clothing c     ON c.clothing_id = oi.clothing_id
    WHERE f.recommendation_session_id = :recommendation_session_id
      AND c.color_cd IS NOT NULL
    UNION ALL
    SELECT 'style', ei.style_cd, f.feedback_type_cd, f.applied_delta
    FROM outfit_feedback f
    JOIN outfit_item oi    ON oi.outfit_id = f.outfit_id AND oi.item_source_cd = 'essential'
    JOIN essential_item ei ON ei.essential_item_id = oi.essential_item_id
    WHERE f.recommendation_session_id = :recommendation_session_id
    UNION ALL
    SELECT 'color', ei.color_cd, f.feedback_type_cd, f.applied_delta
    FROM outfit_feedback f
    JOIN outfit_item oi    ON oi.outfit_id = f.outfit_id AND oi.item_source_cd = 'essential'
    JOIN essential_item ei ON ei.essential_item_id = oi.essential_item_id
    WHERE f.recommendation_session_id = :recommendation_session_id
    """
)


async def insert_feedbacks(
    db: AsyncSession, recommendation_session_id: int, rows: Sequence[FeedbackRow]
) -> None:
    await db.execute(
        INSERT_FEEDBACK_SQL,
        [
            {
                "outfit_id": row.outfit_id,
                "recommendation_session_id": recommendation_session_id,
                "feedback_type_cd": row.feedback_type_cd,
                "rating": row.rating,
                "applied_delta": row.applied_delta,
            }
            for row in rows
        ],
    )


async def find_session_attribute_feedbacks(
    db: AsyncSession, recommendation_session_id: int
) -> list[AttributeFeedback]:
    result = await db.execute(
        SELECT_ATTRIBUTE_FEEDBACKS_SQL, {"recommendation_session_id": recommendation_session_id}
    )
    return [
        AttributeFeedback(
            r.attribute_type_cd, r.attribute_value, r.feedback_type_cd, r.applied_delta
        )
        for r in result
    ]
