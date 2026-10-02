"""완료 상태 옷 + 스타일·계절 태그 조회 (REC-07)."""

from dataclasses import dataclass, field

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


@dataclass
class ClothingCandidate:
    clothing_id: int
    category_cd: str | None
    accessory_type_cd: str | None
    item_name: str | None
    color_cd: str | None
    thickness_cd: str | None
    is_waterproof: bool | None
    origin_image_url: str
    cutout_image_url: str | None
    styles: list[str] = field(default_factory=list)
    seasons: list[str] = field(default_factory=list)


COMPLETED_CLOTHING_SQL = text(
    """
    SELECT c.clothing_id, c.category_cd, c.accessory_type_cd, c.item_name, c.color_cd,
           c.thickness_cd, c.is_waterproof, c.origin_image_url, c.cutout_image_url,
           cs.style_cd, cz.season_cd
    FROM clothing c
    LEFT JOIN clothing_style cs ON cs.clothing_id = c.clothing_id
    LEFT JOIN clothing_season cz ON cz.clothing_id = c.clothing_id
    WHERE c.member_id = :member_id AND c.processing_status_cd = 'completed'
    """
)


async def get_completed_clothing(db: AsyncSession, member_id: int) -> list[ClothingCandidate]:
    """완료 상태 옷을 스타일·계절 태그와 함께 반환한다.

    한 옷에 태그가 여러 개 붙으면 조인 결과에 행이 중복되므로,
    clothing_id 기준으로 모아서 하나의 candidate로 합친다.
    """
    result = await db.execute(COMPLETED_CLOTHING_SQL, {"member_id": member_id})
    rows = result.all()

    by_id: dict[int, ClothingCandidate] = {}
    for row in rows:
        candidate = by_id.get(row.clothing_id)
        if candidate is None:
            candidate = ClothingCandidate(
                clothing_id=row.clothing_id,
                category_cd=row.category_cd,
                accessory_type_cd=row.accessory_type_cd,
                item_name=row.item_name,
                color_cd=row.color_cd,
                thickness_cd=row.thickness_cd,
                is_waterproof=(bool(row.is_waterproof) if row.is_waterproof is not None else None),
                origin_image_url=row.origin_image_url,
                cutout_image_url=row.cutout_image_url,
            )
            by_id[row.clothing_id] = candidate
        if row.style_cd and row.style_cd not in candidate.styles:
            candidate.styles.append(row.style_cd)
        if row.season_cd and row.season_cd not in candidate.seasons:
            candidate.seasons.append(row.season_cd)

    return list(by_id.values())
