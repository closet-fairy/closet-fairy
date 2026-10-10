"""업로드 사진 정규화 (#71, FR-REG-04).

형식은 확장자가 아니라 실제 내용으로 판별한다. 모든 사진을 WEBP로 다시 저장하면서
EXIF 회전을 적용하고 GPS 등 메타데이터를 버린다. 색 표현이 달라지지 않게 ICC 프로파일만 유지한다.
"""

import io
from enum import StrEnum

import pillow_heif
from PIL import Image, ImageOps, UnidentifiedImageError

pillow_heif.register_heif_opener()

ALLOWED_FORMATS = frozenset({"JPEG", "PNG", "WEBP", "HEIF"})
WEBP_MAX_DIMENSION = 16383


class ImageRejectReason(StrEnum):
    UNSUPPORTED_FORMAT = "unsupported_format"
    TOO_LARGE = "too_large"
    UNREADABLE = "unreadable"


class ImageRejectedError(Exception):
    def __init__(self, reason: ImageRejectReason) -> None:
        super().__init__(reason.value)
        self.reason = reason


def normalize_image(data: bytes, *, quality: int) -> bytes:
    try:
        with Image.open(io.BytesIO(data)) as image:
            if image.format not in ALLOWED_FORMATS:
                raise ImageRejectedError(ImageRejectReason.UNSUPPORTED_FORMAT)
            if max(image.size) > WEBP_MAX_DIMENSION:
                raise ImageRejectedError(ImageRejectReason.TOO_LARGE)
            icc_profile = image.info.get("icc_profile")
            image.load()
            upright = ImageOps.exif_transpose(image)
            has_alpha = upright.mode in ("RGBA", "LA", "PA") or "transparency" in upright.info
            converted = upright.convert("RGBA" if has_alpha else "RGB")
    except Image.DecompressionBombError as e:
        raise ImageRejectedError(ImageRejectReason.TOO_LARGE) from e
    except (UnidentifiedImageError, OSError, ValueError) as e:
        raise ImageRejectedError(ImageRejectReason.UNREADABLE) from e

    out = io.BytesIO()
    save_params = {"format": "WEBP", "quality": quality}
    if icc_profile:
        save_params["icc_profile"] = icc_profile
    converted.save(out, **save_params)
    return out.getvalue()
