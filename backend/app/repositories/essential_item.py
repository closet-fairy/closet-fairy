"""에센셜 의류 조회 (REC-09)."""

from collections.abc import Sequence
from dataclasses import dataclass

from sqlalchemy import bindparam, text
from sqlalchemy.ext.asyncio import AsyncSession


@dataclass
class EssentialItemCandidate:
    essential_item_id: int
    item_name: str
    category_cd: str
    accessory_type_cd: str | None
    style_cd: str
    color_cd: str
    thickness_cd: str | None
    is_waterproof: bool
    formality_level: int
    gender_cd: str


ESSENTIAL_ITEM_SQL = text(
    """
    SELECT ei.essential_item_id, ei.item_name, ei.category_cd, ei.accessory_type_cd,
           ei.style_cd, ei.color_cd, ei.thickness_cd, ei.is_waterproof,
           ei.formality_level, ei.gender_cd
      FROM essential_item ei
      JOIN essential_item_season es ON es.essential_item_id = ei.essential_item_id
     WHERE ei.is_active = 1
       AND ei.category_cd = :category_cd
       AND es.season_cd = :season_cd
       AND (:gender_cd = 'unisex' OR ei.gender_cd IN (:gender_cd, 'unisex'))
       AND ei.formality_level BETWEEN :min_formality AND :max_formality
     ORDER BY ei.formality_level, ei.essential_item_id
    """
)


async def get_essential_items(
    db: AsyncSession,
    category_cd: str,
    season_cd: str,
    gender_cd: str,
    min_formality: int,
    max_formality: int,
) -> list[EssentialItemCandidate]:
    """계절·성별·TPO 격식 구간으로 거른 에센셜 의류 후보를 반환한다.

    회원 성별이 unisex면 성별 조건을 걸지 않고 남성용·여성용·유니섹스를 전부 포함한다.
    """
    rows = (
        await db.execute(
            ESSENTIAL_ITEM_SQL,
            {
                "category_cd": category_cd,
                "season_cd": season_cd,
                "gender_cd": gender_cd,
                "min_formality": min_formality,
                "max_formality": max_formality,
            },
        )
    ).all()
    return [
        EssentialItemCandidate(
            essential_item_id=row.essential_item_id,
            item_name=row.item_name,
            category_cd=row.category_cd,
            accessory_type_cd=row.accessory_type_cd,
            style_cd=row.style_cd,
            color_cd=row.color_cd,
            thickness_cd=row.thickness_cd,
            is_waterproof=bool(row.is_waterproof),
            formality_level=row.formality_level,
            gender_cd=row.gender_cd,
        )
        for row in rows
    ]


@dataclass(frozen=True)
class EssentialItemSnapshot:
    essential_item_id: int
    item_name: str
    image_url: str | None


ESSENTIAL_ITEM_SNAPSHOT_SQL = text(
    """
    SELECT essential_item_id, item_name, image_url
      FROM essential_item
     WHERE essential_item_id IN :essential_item_ids
    """
).bindparams(bindparam("essential_item_ids", expanding=True))


async def get_essential_item_snapshots(
    db: AsyncSession, essential_item_ids: Sequence[int]
) -> dict[int, EssentialItemSnapshot]:
    """추천 결과 저장용으로 에센셜 의류의 이름·이미지를 가져온다. 없는 id는 결과에서 빠진다."""
    if not essential_item_ids:
        return {}
    rows = (
        await db.execute(
            ESSENTIAL_ITEM_SNAPSHOT_SQL, {"essential_item_ids": list(essential_item_ids)}
        )
    ).all()
    return {
        row.essential_item_id: EssentialItemSnapshot(
            essential_item_id=row.essential_item_id,
            item_name=row.item_name,
            image_url=row.image_url,
        )
        for row in rows
    }
