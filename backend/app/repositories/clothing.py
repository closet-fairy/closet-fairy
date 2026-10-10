"""옷 조회·등록 — 추천 후보(REC-07), 카테고리별 개수(REC-05), 업로드(#71), 옷장 조회(#74)."""

import json
from collections import defaultdict
from collections.abc import Sequence
from dataclasses import dataclass, field
from datetime import datetime
from decimal import Decimal
from typing import Any

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
    item_name: str | None
    color_nm: str | None
    origin_image_url: str
    cutout_image_url: str | None


CLOTHING_SNAPSHOT_SQL = text(
    """
    SELECT c.clothing_id, c.item_name, co.color_nm,
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
            item_name=row.item_name,
            color_nm=row.color_nm,
            origin_image_url=row.origin_image_url,
            cutout_image_url=row.cutout_image_url,
        )
        for row in rows
    }


INSERT_UPLOADED_CLOTHING_SQL = text(
    """
    INSERT INTO clothing (member_id, origin_image_url, processing_status_cd)
    VALUES (:member_id, :origin_image_url, 'processing')
    """
)

INSERT_BG_REMOVAL_JOB_SQL = text(
    """
    INSERT INTO clothing_job (clothing_id, stage_cd)
    VALUES (:clothing_id, 'bg_removal')
    """
)


async def insert_uploaded_clothing(db: AsyncSession, member_id: int, origin_image_url: str) -> int:
    """처리 중(processing) 옷과 배경 제거 대기 작업을 만든다. commit은 호출자가 한다."""
    result = await db.execute(
        INSERT_UPLOADED_CLOTHING_SQL,
        {"member_id": member_id, "origin_image_url": origin_image_url},
    )
    clothing_id = int(result.lastrowid)
    await db.execute(INSERT_BG_REMOVAL_JOB_SQL, {"clothing_id": clothing_id})
    return clothing_id


@dataclass(frozen=True)
class ClothingCardRow:
    clothing_id: int
    processing_status_cd: str
    reviewed_at: datetime | None
    origin_image_url: str
    cutout_image_url: str | None
    category_cd: str | None
    item_name: str | None
    created_at: datetime
    job_id: int | None
    job_started_at: datetime | None
    job_failure_reason: str | None


@dataclass(frozen=True)
class ClothingDetailRow(ClothingCardRow):
    accessory_type_cd: str | None
    color_cd: str | None
    color_text: str | None
    thickness_cd: str | None
    is_waterproof: bool | None


@dataclass(frozen=True)
class ClothingEditRow:
    rotation_angle: Decimal
    perspective_param: Any
    brush_mask_url: str | None


SEASON_ORDER = ("spring", "summer", "fall", "winter")

_CARD_COLUMNS = """
    c.clothing_id, c.processing_status_cd, c.reviewed_at, c.origin_image_url,
    c.cutout_image_url, c.category_cd, c.item_name, c.created_at,
    j.clothing_job_id AS job_id, j.started_at AS job_started_at,
    j.failure_reason AS job_failure_reason
"""

_LATEST_JOB_JOIN = """
    LEFT JOIN clothing_job j ON j.clothing_job_id = (
        SELECT MAX(lj.clothing_job_id) FROM clothing_job lj WHERE lj.clothing_id = c.clothing_id
    )
"""

CLOTHING_PAGE_SQL = text(
    f"""
    SELECT {_CARD_COLUMNS}
    FROM clothing c
    {_LATEST_JOB_JOIN}
    WHERE c.member_id = :member_id
      AND (:cursor IS NULL OR c.clothing_id < :cursor)
    ORDER BY c.clothing_id DESC
    LIMIT :limit
    """
)

CLOTHING_CARDS_BY_IDS_SQL = text(
    f"""
    SELECT {_CARD_COLUMNS}
    FROM clothing c
    {_LATEST_JOB_JOIN}
    WHERE c.member_id = :member_id AND c.clothing_id IN :clothing_ids
    ORDER BY c.clothing_id DESC
    """
).bindparams(bindparam("clothing_ids", expanding=True))

CLOTHING_DETAIL_SQL = text(
    f"""
    SELECT {_CARD_COLUMNS},
           c.accessory_type_cd, c.color_cd, c.color_text, c.thickness_cd, c.is_waterproof
    FROM clothing c
    {_LATEST_JOB_JOIN}
    WHERE c.member_id = :member_id AND c.clothing_id = :clothing_id
    """
)

CLOTHING_TAGS_SQL = text(
    """
    SELECT 'style' AS tag_type, style_cd AS tag_cd FROM clothing_style
    WHERE clothing_id = :clothing_id
    UNION ALL
    SELECT 'season', season_cd FROM clothing_season
    WHERE clothing_id = :clothing_id
    """
)

CLOTHING_EDIT_SQL = text(
    """
    SELECT rotation_angle, perspective_param, brush_mask_url
    FROM clothing_edit
    WHERE clothing_id = :clothing_id
    """
)


def _card(row) -> ClothingCardRow:
    return ClothingCardRow(
        clothing_id=row.clothing_id,
        processing_status_cd=row.processing_status_cd,
        reviewed_at=row.reviewed_at,
        origin_image_url=row.origin_image_url,
        cutout_image_url=row.cutout_image_url,
        category_cd=row.category_cd,
        item_name=row.item_name,
        created_at=row.created_at,
        job_id=row.job_id,
        job_started_at=row.job_started_at,
        job_failure_reason=row.job_failure_reason,
    )


async def get_clothing_page(
    db: AsyncSession, member_id: int, cursor: int | None, limit: int
) -> list[ClothingCardRow]:
    """등록 역순(clothing_id 내림차순)으로 cursor보다 작은 id부터 limit개를 가져온다."""
    rows = (
        await db.execute(
            CLOTHING_PAGE_SQL, {"member_id": member_id, "cursor": cursor, "limit": limit}
        )
    ).all()
    return [_card(row) for row in rows]


async def get_clothing_cards(
    db: AsyncSession, member_id: int, clothing_ids: Sequence[int]
) -> list[ClothingCardRow]:
    """회원의 옷 중 주어진 id만 가져온다. 없는 id·다른 회원의 id는 결과에서 빠진다."""
    if not clothing_ids:
        return []
    rows = (
        await db.execute(
            CLOTHING_CARDS_BY_IDS_SQL,
            {"member_id": member_id, "clothing_ids": list(clothing_ids)},
        )
    ).all()
    return [_card(row) for row in rows]


async def get_clothing_detail(
    db: AsyncSession, member_id: int, clothing_id: int
) -> ClothingDetailRow | None:
    row = (
        await db.execute(CLOTHING_DETAIL_SQL, {"member_id": member_id, "clothing_id": clothing_id})
    ).first()
    if row is None:
        return None
    return ClothingDetailRow(
        **vars(_card(row)),
        accessory_type_cd=row.accessory_type_cd,
        color_cd=row.color_cd,
        color_text=row.color_text,
        thickness_cd=row.thickness_cd,
        is_waterproof=None if row.is_waterproof is None else bool(row.is_waterproof),
    )


async def get_clothing_tags(db: AsyncSession, clothing_id: int) -> tuple[list[str], list[str]]:
    """(스타일 코드 목록, 계절 코드 목록)을 돌려준다. 스타일은 코드 순, 계절은 봄→겨울 순."""
    rows = (await db.execute(CLOTHING_TAGS_SQL, {"clothing_id": clothing_id})).all()
    styles = sorted(row.tag_cd for row in rows if row.tag_type == "style")
    seasons = sorted(
        (row.tag_cd for row in rows if row.tag_type == "season"), key=SEASON_ORDER.index
    )
    return styles, seasons


async def get_clothing_edit(db: AsyncSession, clothing_id: int) -> ClothingEditRow | None:
    row = (await db.execute(CLOTHING_EDIT_SQL, {"clothing_id": clothing_id})).first()
    if row is None:
        return None
    perspective = row.perspective_param
    return ClothingEditRow(
        rotation_angle=row.rotation_angle,
        perspective_param=json.loads(perspective) if isinstance(perspective, str) else perspective,
        brush_mask_url=row.brush_mask_url,
    )
