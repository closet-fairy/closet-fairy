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
MAX_PIXELS = 50_000_000


def _encode(image: Image.Image, fmt: str, **params) -> bytes:
    out = io.BytesIO()
    image.save(out, format=fmt, **params)
    return out.getvalue()


def _normalize(data: bytes, max_pixels: int = MAX_PIXELS) -> bytes:
    return normalize_image(data, quality=90, max_pixels=max_pixels)


def _open(data: bytes) -> Image.Image:
    image = Image.open(io.BytesIO(data))
    image.load()
    return image


@pytest.mark.parametrize("fmt", ["JPEG", "PNG", "WEBP", "HEIF"])
def test_supported_formats_become_webp(fmt):
    data = _encode(Image.new("RGB", (40, 30), "red"), fmt)

    result = _open(_normalize(data))

    assert result.format == "WEBP"
    assert result.size == (40, 30)


def test_exif_orientation_is_applied_and_metadata_dropped():
    exif = Image.Exif()
    exif[ORIENTATION] = 6
    exif.get_ifd(GPS_IFD)[2] = (37.0, 33.0, 0.0)
    data = _encode(Image.new("RGB", (40, 30), "blue"), "JPEG", exif=exif.tobytes())

    result = _open(_normalize(data))

    assert result.size == (30, 40)
    assert not result.getexif()
    assert "exif" not in result.info


def test_icc_profile_is_kept():
    profile = b"fake-icc-profile"
    data = _encode(Image.new("RGB", (10, 10)), "PNG", icc_profile=profile)

    result = _open(_normalize(data))

    assert result.info.get("icc_profile") == profile


def test_icc_profile_is_dropped_when_color_space_changes():
    data = _encode(Image.new("L", (10, 10)), "PNG", icc_profile=b"fake-gray-profile")

    result = _open(_normalize(data))

    assert "icc_profile" not in result.info


def test_png_transparency_is_kept():
    data = _encode(Image.new("RGBA", (10, 10), (255, 0, 0, 0)), "PNG")

    result = _open(_normalize(data))

    assert result.mode == "RGBA"
    assert result.getpixel((0, 0))[3] == 0


def test_gif_is_unsupported():
    data = _encode(Image.new("RGB", (10, 10)), "GIF")

    with pytest.raises(ImageRejectedError) as e:
        _normalize(data)

    assert e.value.reason is ImageRejectReason.UNSUPPORTED_FORMAT


@pytest.mark.parametrize("data", [b"", b"not an image", b"\xff\xd8\xff\xe0broken jpeg"])
def test_broken_data_is_unreadable(data):
    with pytest.raises(ImageRejectedError) as e:
        _normalize(data)

    assert e.value.reason is ImageRejectReason.UNREADABLE


def test_truncated_image_is_unreadable():
    data = _encode(Image.new("RGB", (200, 200), "green"), "PNG")

    with pytest.raises(ImageRejectedError) as e:
        _normalize(data[: len(data) // 2])

    assert e.value.reason is ImageRejectReason.UNREADABLE


def test_image_wider_than_webp_limit_is_resolution_too_high():
    data = _encode(Image.new("1", (16384, 1)), "PNG")

    with pytest.raises(ImageRejectedError) as e:
        _normalize(data)

    assert e.value.reason is ImageRejectReason.RESOLUTION_TOO_HIGH


def test_pixel_count_over_limit_is_rejected_before_decoding(monkeypatch):
    data = _encode(Image.new("RGB", (20, 10)), "PNG")
    loaded = []
    monkeypatch.setattr(Image.Image, "load", lambda self: loaded.append(self) or None)

    with pytest.raises(ImageRejectedError) as e:
        _normalize(data, max_pixels=199)

    assert e.value.reason is ImageRejectReason.RESOLUTION_TOO_HIGH
    assert loaded == []


def test_pixel_count_at_limit_is_accepted():
    data = _encode(Image.new("RGB", (20, 10)), "PNG")

    assert _open(_normalize(data, max_pixels=200)).size == (20, 10)


def test_decompression_bomb_is_resolution_too_high(monkeypatch):
    monkeypatch.setattr(Image, "MAX_IMAGE_PIXELS", 10)
    data = _encode(Image.new("RGB", (10, 10)), "PNG")

    with pytest.raises(ImageRejectedError) as e:
        _normalize(data)

    assert e.value.reason is ImageRejectReason.RESOLUTION_TOO_HIGH


def test_multi_picture_jpeg_is_accepted_as_first_frame():
    first, second = Image.new("RGB", (40, 30), "red"), Image.new("RGB", (20, 15), "blue")
    data = _encode(first, "MPO", save_all=True, append_images=[second])
    assert Image.open(io.BytesIO(data)).format == "MPO"

    result = _open(_normalize(data))

    assert result.format == "WEBP"
    assert result.size == (40, 30)
