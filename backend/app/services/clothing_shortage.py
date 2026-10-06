"""의류 부족 사전 안내 (REC-05)."""

from collections.abc import Mapping
from dataclasses import dataclass

from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories import clothing as clothing_repo

SHORTAGE_CHECK_CATEGORIES = ("top", "bottom", "shoes")
MIN_ITEMS_PER_CATEGORY = 2
CLOTHING_SHORTAGE_NOTICE_CD = "clothing_shortage"


def shortage_categories_from_counts(counts: Mapping[str, int]) -> set[str]:
    """의류 부족 판정 기준(FR-REC-10)은 여기 한곳에만 둔다.

    에센셜 보충(shortage_categories 경유)과 사전 안내(clothing_shortage)가 같이 쓴다.
    """
    return {
        category_cd
        for category_cd in SHORTAGE_CHECK_CATEGORIES
        if counts.get(category_cd, 0) < MIN_ITEMS_PER_CATEGORY
    }


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
