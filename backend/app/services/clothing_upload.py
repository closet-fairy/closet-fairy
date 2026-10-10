"""옷 사진 업로드 (#71, FR-REG). 사진 1장 = 옷 1벌.

사진 정규화는 CPU를 써서 스레드에서 돌리고, 메모리를 아끼려고 동시에 몇 장만 처리한다.
정상 사진만 저장하고 옷·배경 제거 작업을 한 트랜잭션으로 만든다. 처리는 기다리지 않는다.
DB 저장이 실패하면 이미 저장한 이미지를 지운다.
"""

import asyncio
import logging
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Protocol
from uuid import uuid4

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.core.errors import ValidationError
from app.repositories import clothing as clothing_repo
from app.schemas.clothing import ClothingUploadResult, RejectedUpload, UploadedClothing
from app.services.clothing_image import ImageRejectedError, ImageRejectReason, normalize_image
from app.services.storage import ImageStorage

logger = logging.getLogger(__name__)


class UploadFileLike(Protocol):
    filename: str | None

    async def read(self, size: int = -1) -> bytes: ...


class NoUploadFilesError(ValidationError):
    code = "CLOTHING_FILES_REQUIRED"
    message = "올릴 사진을 골라 주세요."


class TooManyUploadFilesError(ValidationError):
    code = "CLOTHING_TOO_MANY_FILES"


@dataclass(frozen=True)
class _SavedImage:
    file_name: str | None
    key: str


def reject_message(reason: ImageRejectReason, max_bytes: int) -> str:
    if reason is ImageRejectReason.UNSUPPORTED_FORMAT:
        return "JPG, PNG, WEBP, HEIC 사진만 올릴 수 있습니다."
    if reason is ImageRejectReason.TOO_LARGE:
        return f"사진이 너무 큽니다. {max_bytes // (1024 * 1024)}MB 이하로 올려 주세요."
    return "사진을 읽을 수 없습니다. 다른 사진으로 다시 올려 주세요."


async def upload_clothing(
    db: AsyncSession,
    storage: ImageStorage,
    member_id: int,
    files: Sequence[UploadFileLike],
) -> ClothingUploadResult:
    settings = get_settings()
    if not files:
        raise NoUploadFilesError()
    if len(files) > settings.CLOTHING_UPLOAD_MAX_FILES:
        raise TooManyUploadFilesError(
            f"사진은 한 번에 {settings.CLOTHING_UPLOAD_MAX_FILES}장까지 올릴 수 있습니다."
        )

    semaphore = asyncio.Semaphore(settings.CLOTHING_IMAGE_NORMALIZE_CONCURRENCY)

    async def prepare(file: UploadFileLike) -> bytes:
        async with semaphore:
            return await _read_and_normalize(file, settings)

    outcomes = await asyncio.gather(*(prepare(f) for f in files), return_exceptions=True)

    saved: list[_SavedImage] = []
    rejected: list[RejectedUpload] = []
    try:
        for file, image in zip(files, outcomes, strict=True):
            if isinstance(image, ImageRejectedError):
                rejected.append(
                    RejectedUpload(
                        file_name=file.filename,
                        reason_cd=image.reason.value,
                        message=reject_message(image.reason, settings.CLOTHING_UPLOAD_MAX_BYTES),
                    )
                )
                continue
            if isinstance(image, BaseException):
                raise image
            key = f"clothing/{member_id}/{uuid4().hex}.webp"
            await storage.save(key, image)
            saved.append(_SavedImage(file.filename, key))

        clothing_ids: list[int] = []
        if saved:
            async with db.begin():
                for image in saved:
                    clothing_ids.append(
                        await clothing_repo.insert_uploaded_clothing(db, member_id, image.key)
                    )
    except Exception:
        await _delete_quietly(storage, [image.key for image in saved])
        raise

    return ClothingUploadResult(
        accepted=[
            UploadedClothing(
                clothing_id=clothing_id,
                processing_status_cd="processing",
                image_url=storage.url(image.key),
                file_name=image.file_name,
            )
            for clothing_id, image in zip(clothing_ids, saved, strict=True)
        ],
        rejected=rejected,
    )


async def _read_and_normalize(file: UploadFileLike, settings: Settings) -> bytes:
    data = await file.read(settings.CLOTHING_UPLOAD_MAX_BYTES + 1)
    if len(data) > settings.CLOTHING_UPLOAD_MAX_BYTES:
        raise ImageRejectedError(ImageRejectReason.TOO_LARGE)
    return await asyncio.to_thread(
        normalize_image, data, quality=settings.CLOTHING_IMAGE_WEBP_QUALITY
    )


async def _delete_quietly(storage: ImageStorage, keys: Sequence[str]) -> None:
    for key in keys:
        try:
            await storage.delete(key)
        except Exception:
            logger.warning("업로드 실패 후 이미지 정리 실패", exc_info=True, extra={"key": key})
