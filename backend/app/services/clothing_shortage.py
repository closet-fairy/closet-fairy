"""의류 부족 사전 안내 (REC-05)."""

from dataclasses import dataclass

from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories import clothing as clothing_repo
from app.services.essential_supplement import (
    SHORTAGE_CHECK_CATEGORIES,
    shortage_categories_from_counts,
)

CLOTHING_SHORTAGE_NOTICE_CD = "clothing_shortage"


@dataclass
class ClothingShortagePrecheck:
    is_clothing_shortage: bool
    category_counts: dict[str, int]
    shortage_categories: list[str]
    notice_cd: str | None


def judge_clothing_shortage(category_counts: dict[str, int]) -> ClothingShortagePrecheck:
    shortage = shortage_categories_from_counts(category_counts)
    is_clothing_shortage = bool(shortage)
    return ClothingShortagePrecheck(
        is_clothing_shortage=is_clothing_shortage,
        category_counts=category_counts,
        shortage_categories=[c for c in SHORTAGE_CHECK_CATEGORIES if c in shortage],
        notice_cd=CLOTHING_SHORTAGE_NOTICE_CD if is_clothing_shortage else None,
    )


async def precheck_clothing_shortage(db: AsyncSession, member_id: int) -> ClothingShortagePrecheck:
    category_counts = await clothing_repo.count_completed_by_category(
        db, member_id, SHORTAGE_CHECK_CATEGORIES
    )
    return judge_clothing_shortage(category_counts)
