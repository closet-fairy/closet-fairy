"""업로드 사진 정규화 (#71, FR-REG-04).

형식은 확장자가 아니라 실제 내용으로 판별한다. 모든 사진을 WEBP로 다시 저장하면서
EXIF 회전을 적용하고 GPS 등 메타데이터를 버린다. 색 표현이 달라지지 않게 ICC 프로파일만 유지한다.
화소 수는 디코딩 전에 검사한다. 한 장을 디코딩하는 데 화소 수에 비례하는 메모리가 들기 때문이다.
"""

import io
from enum import StrEnum

import pillow_heif
from PIL import Image, ImageOps, UnidentifiedImageError

pillow_heif.register_heif_opener()

ALLOWED_FORMATS = frozenset({"JPEG", "MPO", "PNG", "WEBP", "HEIF"})
WEBP_MAX_DIMENSION = 16383
COLOR_SPACE_KEEPING_MODES = frozenset({"RGB", "RGBA", "P", "PA"})


class ImageRejectReason(StrEnum):
    UNSUPPORTED_FORMAT = "unsupported_format"
    TOO_LARGE = "too_large"
    RESOLUTION_TOO_HIGH = "resolution_too_high"
    UNREADABLE = "unreadable"


class ImageRejectedError(Exception):
    def __init__(self, reason: ImageRejectReason) -> None:
        super().__init__(reason.value)
        self.reason = reason


def normalize_image(data: bytes, *, quality: int, max_pixels: int) -> bytes:
    try:
        with Image.open(io.BytesIO(data)) as image:
            if image.format not in ALLOWED_FORMATS:
                raise ImageRejectedError(ImageRejectReason.UNSUPPORTED_FORMAT)
            width, height = image.size
            if width * height > max_pixels or max(width, height) > WEBP_MAX_DIMENSION:
                raise ImageRejectedError(ImageRejectReason.RESOLUTION_TOO_HIGH)
            keeps_color_space = image.mode in COLOR_SPACE_KEEPING_MODES
            icc_profile = image.info.get("icc_profile") if keeps_color_space else None
            image.load()
            ImageOps.exif_transpose(image, in_place=True)
            has_alpha = image.mode in ("RGBA", "LA", "PA") or "transparency" in image.info
            converted = image.convert("RGBA" if has_alpha else "RGB")
        out = io.BytesIO()
        save_params = {"format": "WEBP", "quality": quality}
        if icc_profile:
            save_params["icc_profile"] = icc_profile
        converted.save(out, **save_params)
    except Image.DecompressionBombError as e:
        raise ImageRejectedError(ImageRejectReason.RESOLUTION_TOO_HIGH) from e
    except (UnidentifiedImageError, OSError, ValueError) as e:
        raise ImageRejectedError(ImageRejectReason.UNREADABLE) from e
    return out.getvalue()
