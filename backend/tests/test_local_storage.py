"""로컬 이미지 저장소 테스트."""

import pytest

from app.services.storage import LocalImageStorage


@pytest.fixture
def storage(tmp_path):
    return LocalImageStorage(tmp_path / "media", "/media/")


async def test_save_creates_folders_and_writes_bytes(storage, tmp_path):
    await storage.save("clothing/1/a.webp", b"image")

    assert (tmp_path / "media/clothing/1/a.webp").read_bytes() == b"image"


async def test_read_returns_saved_bytes(storage):
    await storage.save("clothing/1/a.webp", b"image")

    assert await storage.read("clothing/1/a.webp") == b"image"


async def test_delete_removes_file_and_ignores_missing(storage, tmp_path):
    await storage.save("clothing/1/a.webp", b"image")

    await storage.delete("clothing/1/a.webp")
    await storage.delete("clothing/1/a.webp")

    assert not (tmp_path / "media/clothing/1/a.webp").exists()


def test_url_joins_prefix_and_key(storage):
    assert storage.url("clothing/1/a.webp") == "/media/clothing/1/a.webp"


@pytest.mark.parametrize("key", ["../outside.webp", "clothing/../../outside.webp", ""])
async def test_keys_outside_root_are_refused(storage, key):
    with pytest.raises(ValueError):
        await storage.save(key, b"image")
