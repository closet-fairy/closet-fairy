"""옷 속성 수정과 이미지 편집값 저장 (#75, FR-EDIT).

편집값은 원본 이미지에 굽지 않고 파라미터로만 저장한다(FR-EDIT-06). 수정해도 자동 태깅을
다시 하지 않는다. 동시에 고치면 마지막 저장이 남는다(NFR-EDIT-03).
"""

import asyncio
import logging
from typing import BinaryIO
from uuid import uuid4

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.errors import ConflictError, ValidationError
from app.repositories import clothing as clothing_repo
from app.repositories import clothing_tag as tag_repo
from app.repositories.clothing import ClothingForEdit
from app.schemas.clothing import ClothingDetail, ClothingEditUpdate, ClothingUpdate
from app.services.clothing_image import (
    ImageRejectedError,
    ImageRejectReason,
    image_size,
    normalize_mask,
)
from app.services.clothing_query import ClothingNotFoundError, get_clothing_detail
from app.services.storage import ImageStorage

logger = logging.getLogger(__name__)

ACCESSORIES = "accessories"


class ClothingNotEditableError(ConflictError):
    code = "CLOTHING_NOT_EDITABLE"
    message = "처리가 끝난 옷만 수정할 수 있습니다."


class AccessoryTypeNotAllowedError(ValidationError):
    code = "CLOTHING_ACCESSORY_TYPE_NOT_ALLOWED"
    message = "악세서리 종류는 분류가 악세서리일 때만 정할 수 있습니다."


class InvalidMaskError(ValidationError):
    code = "CLOTHING_MASK_INVALID"
    message = "브러시 마스크는 PNG 이미지로 올려 주세요."


class MaskSizeMismatchError(ValidationError):
    code = "CLOTHING_MASK_SIZE_MISMATCH"
    message = "브러시 마스크는 옷 이미지와 크기가 같아야 합니다."


async def update_clothing(
    db: AsyncSession,
    storage: ImageStorage,
    member_id: int,
    clothing_id: int,
    update: ClothingUpdate,
) -> ClothingDetail:
    async with db.begin():
        clothing = await _lock_editable(db, member_id, clothing_id)
        values = _attribute_values(clothing, update)
        await clothing_repo.update_clothing_attributes(db, clothing_id, values)
        fields = update.model_fields_set
        if "style_cds" in fields:
            await tag_repo.replace_styles(db, clothing_id, _unique(update.style_cds))
        if "season_cds" in fields:
            await tag_repo.replace_seasons(db, clothing_id, _unique(update.season_cds))
        await clothing_repo.mark_reviewed(db, clothing_id)
    return await get_clothing_detail(db, storage, member_id, clothing_id)


async def mark_reviewed(db: AsyncSession, member_id: int, clothing_id: int) -> None:
    """상세를 연 옷의 신규 표시를 끈다(FR-REG-16). 처리가 끝나지 않은 옷은 그대로 둔다."""
    async with db.begin():
        clothing = await clothing_repo.get_clothing_for_edit(db, member_id, clothing_id)
        if clothing is None:
            raise ClothingNotFoundError()
        if clothing.processing_status_cd == "completed":
            await clothing_repo.mark_reviewed(db, clothing_id)


async def save_edit(
    db: AsyncSession,
    storage: ImageStorage,
    member_id: int,
    clothing_id: int,
    edit: ClothingEditUpdate,
) -> ClothingDetail:
    perspective = edit.perspective_param.model_dump() if edit.perspective_param else None
    async with db.begin():
        await _lock_editable(db, member_id, clothing_id)
        await clothing_repo.upsert_edit_transform(db, clothing_id, edit.rotation_angle, perspective)
        await clothing_repo.mark_reviewed(db, clothing_id)
    return await get_clothing_detail(db, storage, member_id, clothing_id)


async def save_mask(
    db: AsyncSession,
    storage: ImageStorage,
    member_id: int,
    clothing_id: int,
    file: BinaryIO,
) -> ClothingDetail:
    async with db.begin():
        clothing = await clothing_repo.get_clothing_for_edit(db, member_id, clothing_id)
    _ensure_editable(clothing)
    try:
        mask, mask_size = await asyncio.to_thread(_read_mask, file)
    except ImageRejectedError as e:
        raise InvalidMaskError() from e
    base = await storage.read(clothing.cutout_image_url or clothing.origin_image_url)
    if await asyncio.to_thread(image_size, base) != mask_size:
        raise MaskSizeMismatchError()

    key = f"clothing/{member_id}/{uuid4().hex}_mask.png"
    await storage.save(key, mask)
    try:
        async with db.begin():
            await _lock_editable(db, member_id, clothing_id)
            previous = await clothing_repo.get_clothing_edit(db, clothing_id)
            await clothing_repo.upsert_edit_mask(db, clothing_id, key)
            await clothing_repo.mark_reviewed(db, clothing_id)
    except Exception:
        await _delete_quietly(storage, key)
        raise
    if previous is not None and previous.brush_mask_url:
        await _delete_quietly(storage, previous.brush_mask_url)
    return await get_clothing_detail(db, storage, member_id, clothing_id)


async def reset_edit(
    db: AsyncSession, storage: ImageStorage, member_id: int, clothing_id: int
) -> ClothingDetail:
    async with db.begin():
        await _lock_editable(db, member_id, clothing_id)
        previous = await clothing_repo.get_clothing_edit(db, clothing_id)
        await clothing_repo.delete_clothing_edit(db, clothing_id)
        await clothing_repo.mark_reviewed(db, clothing_id)
    if previous is not None and previous.brush_mask_url:
        await _delete_quietly(storage, previous.brush_mask_url)
    return await get_clothing_detail(db, storage, member_id, clothing_id)


async def _lock_editable(db: AsyncSession, member_id: int, clothing_id: int) -> ClothingForEdit:
    clothing = await clothing_repo.get_clothing_for_edit(db, member_id, clothing_id, lock=True)
    _ensure_editable(clothing)
    return clothing


def _ensure_editable(clothing: ClothingForEdit | None) -> None:
    if clothing is None:
        raise ClothingNotFoundError()
    if clothing.processing_status_cd != "completed":
        raise ClothingNotEditableError()


def _attribute_values(clothing: ClothingForEdit, update: ClothingUpdate) -> dict:
    fields = update.model_fields_set
    values = {
        column: getattr(update, column)
        for column in clothing_repo.EDITABLE_ATTRIBUTE_COLUMNS
        if column in fields
    }
    if "item_name" in values:
        values["item_name"] = _blank_to_none(values["item_name"])
    if "color_text" in values:
        values["color_text"] = _blank_to_none(values["color_text"])

    category = values.get("category_cd", clothing.category_cd)
    if category != ACCESSORIES:
        if values.get("accessory_type_cd") is not None:
            raise AccessoryTypeNotAllowedError()
        if clothing.accessory_type_cd is not None:
            values["accessory_type_cd"] = None

    color_changed = "color_cd" in values and values["color_cd"] != clothing.color_cd
    if color_changed and "color_text" not in values:
        values["color_text"] = None
    return values


def _blank_to_none(value: str | None) -> str | None:
    if value is None:
        return None
    value = " ".join(value.split())
    return value or None


def _unique(codes: list[str] | None) -> tuple[str, ...]:
    return tuple(dict.fromkeys(codes or ()))


def _read_mask(file: BinaryIO) -> tuple[bytes, tuple[int, int]]:
    settings = get_settings()
    data = file.read(settings.CLOTHING_UPLOAD_MAX_BYTES + 1)
    if len(data) > settings.CLOTHING_UPLOAD_MAX_BYTES:
        raise ImageRejectedError(ImageRejectReason.TOO_LARGE)
    return normalize_mask(data, max_pixels=settings.CLOTHING_IMAGE_MAX_PIXELS)


async def _delete_quietly(storage: ImageStorage, key: str) -> None:
    try:
        await storage.delete(key)
    except Exception:
        logger.warning("브러시 마스크 파일 정리 실패", exc_info=True, extra={"key": key})
