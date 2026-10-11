"""배경 제거 모델 래퍼 테스트. rembg는 가짜 모듈로 바꿔 끼운다."""

import io
import sys
import types

import pytest
from PIL import Image

from app.services.bg_removal import BackgroundRemover


@pytest.fixture
def fake_rembg(monkeypatch):
    calls = {"sessions": [], "inputs": []}

    def new_session(model_name):
        calls["sessions"].append(model_name)
        return f"session-{model_name}"

    def remove(image, session, post_process_mask):
        calls["inputs"].append((image.size, session, post_process_mask))
        cutout = image.convert("RGBA")
        cutout.putpixel((0, 0), (0, 0, 0, 0))
        return cutout

    module = types.SimpleNamespace(new_session=new_session, remove=remove)
    monkeypatch.setitem(sys.modules, "rembg", module)
    return calls


def _png(size) -> bytes:
    out = io.BytesIO()
    Image.new("RGB", size, "navy").save(out, format="PNG")
    return out.getvalue()


def test_rembg_is_loaded_only_when_remover_is_created():
    import app.services.bg_removal as module

    assert not hasattr(module, "remove")
    assert not hasattr(module, "new_session")


def test_large_image_is_shrunk_to_max_side_and_saved_as_webp(fake_rembg):
    remover = BackgroundRemover("isnet-general-use", True, max_side=100, webp_quality=90)

    result = Image.open(io.BytesIO(remover.remove(_png((400, 200)))))

    assert fake_rembg["sessions"] == ["isnet-general-use"]
    assert fake_rembg["inputs"] == [((100, 50), "session-isnet-general-use", True)]
    assert (result.format, result.mode, result.size) == ("WEBP", "RGBA", (100, 50))
    assert result.getpixel((0, 0))[3] == 0


def test_small_image_keeps_its_size(fake_rembg):
    remover = BackgroundRemover("isnet-general-use", False, max_side=100, webp_quality=90)

    result = Image.open(io.BytesIO(remover.remove(_png((60, 40)))))

    assert fake_rembg["inputs"][0][0] == (60, 40)
    assert result.size == (60, 40)


def test_exif_orientation_is_applied_before_removal(fake_rembg):
    exif = Image.Exif()
    exif[0x0112] = 6
    out = io.BytesIO()
    Image.new("RGB", (40, 20), "navy").save(out, format="JPEG", exif=exif.tobytes())
    remover = BackgroundRemover("isnet-general-use", True, max_side=100, webp_quality=90)

    result = Image.open(io.BytesIO(remover.remove(out.getvalue())))

    assert fake_rembg["inputs"][0][0] == (20, 40)
    assert result.size == (20, 40)
