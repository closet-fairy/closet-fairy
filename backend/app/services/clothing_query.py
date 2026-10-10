"""옷장 조회 (#74). 목록·상태·상세.

DB에는 이미지 저장소 키가 들어 있으므로 응답할 때 저장소가 URL로 바꾼다.
"""

from collections.abc import Sequence

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotFoundError, ValidationError
from app.repositories import clothing as clothing_repo
from app.repositories.clothing import ClothingCardRow, ClothingEditRow
from app.schemas.clothing import (
    ClothingCard,
    ClothingDetail,
    ClothingEdit,
    ClothingPage,
    ClothingProgress,
    ClothingStatusList,
)
from app.services.recommendation_session import from_db_utc
from app.services.storage import ImageStorage

MAX_STATUS_IDS = 50


class ClothingNotFoundError(NotFoundError):
    code = "CLOTHING_NOT_FOUND"
    message = "옷을 찾을 수 없습니다."


class TooManyStatusIdsError(ValidationError):
    code = "CLOTHING_TOO_MANY_IDS"
    message = f"상태는 한 번에 {MAX_STATUS_IDS}벌까지 조회할 수 있습니다."


async def get_clothing_page(
    db: AsyncSession, storage: ImageStorage, member_id: int, cursor: int | None, limit: int
) -> ClothingPage:
    rows = await clothing_repo.get_clothing_page(db, member_id, cursor, limit + 1)
    has_more = len(rows) > limit
    rows = rows[:limit]
    return ClothingPage(
        items=[_to_card(row, storage) for row in rows],
        next_cursor=rows[-1].clothing_id if has_more else None,
    )


async def get_clothing_status(
    db: AsyncSession, storage: ImageStorage, member_id: int, clothing_ids: Sequence[int]
) -> ClothingStatusList:
    unique_ids = sorted(set(clothing_ids))
    if len(unique_ids) > MAX_STATUS_IDS:
        raise TooManyStatusIdsError()
    rows = await clothing_repo.get_clothing_cards(db, member_id, unique_ids)
    return ClothingStatusList(items=[_to_progress(row, storage) for row in rows])


async def get_clothing_detail(
    db: AsyncSession, storage: ImageStorage, member_id: int, clothing_id: int
) -> ClothingDetail:
    row = await clothing_repo.get_clothing_detail(db, member_id, clothing_id)
    if row is None:
        raise ClothingNotFoundError()
    style_cds, season_cds = await clothing_repo.get_clothing_tags(db, clothing_id)
    edit = await clothing_repo.get_clothing_edit(db, clothing_id)
    return ClothingDetail(
        **_card_fields(row, storage),
        origin_image_url=storage.url(row.origin_image_url),
        cutout_image_url=storage.url(row.cutout_image_url) if row.cutout_image_url else None,
        accessory_type_cd=row.accessory_type_cd,
        color_cd=row.color_cd,
        color_text=row.color_text,
        thickness_cd=row.thickness_cd,
        is_waterproof=row.is_waterproof,
        style_cds=style_cds,
        season_cds=season_cds,
        edit=_to_edit(edit, storage) if edit else None,
    )


def _progress_fields(row: ClothingCardRow, storage: ImageStorage) -> dict:
    is_processing = row.processing_status_cd == "processing"
    return {
        "clothing_id": row.clothing_id,
        "processing_status_cd": row.processing_status_cd,
        "is_queued": is_processing and row.job_id is not None and row.job_started_at is None,
        "image_url": storage.url(row.cutout_image_url or row.origin_image_url),
        "failure_reason": (
            row.job_failure_reason if row.processing_status_cd == "failed" else None
        ),
    }


def _card_fields(row: ClothingCardRow, storage: ImageStorage) -> dict:
    return {
        **_progress_fields(row, storage),
        "is_new": row.reviewed_at is None,
        "category_cd": row.category_cd,
        "item_name": row.item_name,
        "created_at": from_db_utc(row.created_at),
    }


def _to_progress(row: ClothingCardRow, storage: ImageStorage) -> ClothingProgress:
    return ClothingProgress(**_progress_fields(row, storage))


def _to_card(row: ClothingCardRow, storage: ImageStorage) -> ClothingCard:
    return ClothingCard(**_card_fields(row, storage))


def _to_edit(edit: ClothingEditRow, storage: ImageStorage) -> ClothingEdit:
    return ClothingEdit(
        rotation_angle=float(edit.rotation_angle),
        perspective_param=edit.perspective_param,
        brush_mask_url=storage.url(edit.brush_mask_url) if edit.brush_mask_url else None,
    )
