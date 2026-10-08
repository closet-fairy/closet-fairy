"""완료 상태 옷 조회 — 스타일·계절 태그 포함 목록(REC-07), 카테고리별 개수(REC-05)."""

from collections import defaultdict
from collections.abc import Sequence
from dataclasses import dataclass, field

from sqlalchemy import bindparam, text
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


CLOTHING_SQL = text(
    """
    SELECT clothing_id, category_cd, accessory_type_cd, item_name, color_cd,
           thickness_cd, is_waterproof, origin_image_url, cutout_image_url
    FROM clothing
    WHERE member_id = :member_id AND processing_status_cd = 'completed'
    """
)

STYLES_SQL = text(
    """
    SELECT cs.clothing_id, cs.style_cd
    FROM clothing_style cs
    JOIN clothing c ON c.clothing_id = cs.clothing_id
    WHERE c.member_id = :member_id AND c.processing_status_cd = 'completed'
    """
)

SEASONS_SQL = text(
    """
    SELECT cz.clothing_id, cz.season_cd
    FROM clothing_season cz
    JOIN clothing c ON c.clothing_id = cz.clothing_id
    WHERE c.member_id = :member_id AND c.processing_status_cd = 'completed'
    """
)


async def get_completed_clothing(db: AsyncSession, member_id: int) -> list[ClothingCandidate]:
    """완료 상태 옷을 스타일·계절 태그와 함께 반환한다.

    태그를 같은 쿼리에서 LEFT JOIN하면 옷 한 벌당 행 수가 (스타일 수 × 계절 수)로
    곱해지므로, 태그는 별도 쿼리 2번으로 받아 옷 id 기준으로 합친다.
    """
    clothing_rows = (await db.execute(CLOTHING_SQL, {"member_id": member_id})).all()
    style_rows = (await db.execute(STYLES_SQL, {"member_id": member_id})).all()
    season_rows = (await db.execute(SEASONS_SQL, {"member_id": member_id})).all()

    styles_by_id: dict[int, list[str]] = defaultdict(list)
    for row in style_rows:
        styles_by_id[row.clothing_id].append(row.style_cd)

    seasons_by_id: dict[int, list[str]] = defaultdict(list)
    for row in season_rows:
        seasons_by_id[row.clothing_id].append(row.season_cd)

    return [
        ClothingCandidate(
            clothing_id=row.clothing_id,
            category_cd=row.category_cd,
            accessory_type_cd=row.accessory_type_cd,
            item_name=row.item_name,
            color_cd=row.color_cd,
            thickness_cd=row.thickness_cd,
            is_waterproof=(bool(row.is_waterproof) if row.is_waterproof is not None else None),
            origin_image_url=row.origin_image_url,
            cutout_image_url=row.cutout_image_url,
            styles=styles_by_id.get(row.clothing_id, []),
            seasons=seasons_by_id.get(row.clothing_id, []),
        )
        for row in clothing_rows
    ]


COMPLETED_COUNT_BY_CATEGORY_SQL = text(
    """
    SELECT category_cd, COUNT(*) AS cnt
    FROM clothing
    WHERE member_id = :member_id AND processing_status_cd = 'completed'
      AND category_cd IN :category_cds
    GROUP BY category_cd
    """
).bindparams(bindparam("category_cds", expanding=True))


async def count_completed_by_category(
    db: AsyncSession, member_id: int, category_cds: Sequence[str]
) -> dict[str, int]:
    rows = (
        await db.execute(
            COMPLETED_COUNT_BY_CATEGORY_SQL,
            {"member_id": member_id, "category_cds": list(category_cds)},
        )
    ).all()
    counts = {category_cd: 0 for category_cd in category_cds}
    counts.update({row.category_cd: row.cnt for row in rows})
    return counts


@dataclass(frozen=True)
class ClothingSnapshot:
    clothing_id: int
    accessory_type_cd: str | None
    item_name: str | None
    color_nm: str | None
    origin_image_url: str
    cutout_image_url: str | None


CLOTHING_SNAPSHOT_SQL = text(
    """
    SELECT c.clothing_id, c.accessory_type_cd, c.item_name, co.color_nm,
           c.origin_image_url, c.cutout_image_url
    FROM clothing c
    LEFT JOIN color co ON co.color_cd = c.color_cd
    WHERE c.member_id = :member_id AND c.clothing_id IN :clothing_ids
    """
).bindparams(bindparam("clothing_ids", expanding=True))


async def get_clothing_snapshots(
    db: AsyncSession, member_id: int, clothing_ids: Sequence[int]
) -> dict[int, ClothingSnapshot]:
    """추천 결과 저장용으로 옷의 현재 이름·이미지를 가져온다. 없는 id는 결과에서 빠진다."""
    if not clothing_ids:
        return {}
    rows = (
        await db.execute(
            CLOTHING_SNAPSHOT_SQL,
            {"member_id": member_id, "clothing_ids": list(clothing_ids)},
        )
    ).all()
    return {
        row.clothing_id: ClothingSnapshot(
            clothing_id=row.clothing_id,
            accessory_type_cd=row.accessory_type_cd,
            item_name=row.item_name,
            color_nm=row.color_nm,
            origin_image_url=row.origin_image_url,
            cutout_image_url=row.cutout_image_url,
        )
        for row in rows
    }
