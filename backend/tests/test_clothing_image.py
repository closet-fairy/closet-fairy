"""업로드 사진 정규화 테스트. 테스트 이미지는 Pillow로 그 자리에서 만든다."""

import io

import pytest
from PIL import Image

from app.services.clothing_image import (
    ImageRejectedError,
    ImageRejectReason,
    normalize_image,
)

GPS_IFD = 0x8825
ORIENTATION = 0x0112


def _encode(image: Image.Image, fmt: str, **params) -> bytes:
    out = io.BytesIO()
    image.save(out, format=fmt, **params)
    return out.getvalue()


def _open(data: bytes) -> Image.Image:
    image = Image.open(io.BytesIO(data))
    image.load()
    return image


@pytest.mark.parametrize("fmt", ["JPEG", "PNG", "WEBP", "HEIF"])
def test_supported_formats_become_webp(fmt):
    data = _encode(Image.new("RGB", (40, 30), "red"), fmt)

    result = _open(normalize_image(data, quality=90))

    assert result.format == "WEBP"
    assert result.size == (40, 30)


def test_exif_orientation_is_applied_and_metadata_dropped():
    exif = Image.Exif()
    exif[ORIENTATION] = 6
    exif.get_ifd(GPS_IFD)[2] = (37.0, 33.0, 0.0)
    data = _encode(Image.new("RGB", (40, 30), "blue"), "JPEG", exif=exif.tobytes())

    result = _open(normalize_image(data, quality=90))

    assert result.size == (30, 40)
    assert not result.getexif()
    assert "exif" not in result.info


def test_icc_profile_is_kept():
    profile = b"fake-icc-profile"
    data = _encode(Image.new("RGB", (10, 10)), "PNG", icc_profile=profile)

    result = _open(normalize_image(data, quality=90))

    assert result.info.get("icc_profile") == profile


def test_png_transparency_is_kept():
    data = _encode(Image.new("RGBA", (10, 10), (255, 0, 0, 0)), "PNG")

    result = _open(normalize_image(data, quality=90))

    assert result.mode == "RGBA"
    assert result.getpixel((0, 0))[3] == 0


def test_gif_is_unsupported():
    data = _encode(Image.new("RGB", (10, 10)), "GIF")

    with pytest.raises(ImageRejectedError) as e:
        normalize_image(data, quality=90)

    assert e.value.reason is ImageRejectReason.UNSUPPORTED_FORMAT


@pytest.mark.parametrize("data", [b"", b"not an image", b"\xff\xd8\xff\xe0broken jpeg"])
def test_broken_data_is_unreadable(data):
    with pytest.raises(ImageRejectedError) as e:
        normalize_image(data, quality=90)

    assert e.value.reason is ImageRejectReason.UNREADABLE


def test_truncated_image_is_unreadable():
    data = _encode(Image.new("RGB", (200, 200), "green"), "PNG")

    with pytest.raises(ImageRejectedError) as e:
        normalize_image(data[: len(data) // 2], quality=90)

    assert e.value.reason is ImageRejectReason.UNREADABLE


def test_image_wider_than_webp_limit_is_too_large():
    data = _encode(Image.new("1", (16384, 1)), "PNG")

    with pytest.raises(ImageRejectedError) as e:
        normalize_image(data, quality=90)

    assert e.value.reason is ImageRejectReason.TOO_LARGE


def test_decompression_bomb_is_too_large(monkeypatch):
    monkeypatch.setattr(Image, "MAX_IMAGE_PIXELS", 10)
    data = _encode(Image.new("RGB", (10, 10)), "PNG")

    with pytest.raises(ImageRejectedError) as e:
        normalize_image(data, quality=90)

    assert e.value.reason is ImageRejectReason.TOO_LARGE
