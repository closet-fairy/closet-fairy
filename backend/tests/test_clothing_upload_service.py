"""옷 사진 업로드 서비스 테스트. DB·저장소·리포지토리는 가짜로 바꿔 끼운다."""

import asyncio
import io

import pytest
from PIL import Image

from app.core.config import get_settings
from app.services import clothing_upload as upload
from app.services.clothing_upload import NoUploadFilesError, TooManyUploadFilesError


def _image_bytes(fmt: str = "JPEG", size=(20, 10)) -> bytes:
    out = io.BytesIO()
    Image.new("RGB", size, "red").save(out, format=fmt)
    return out.getvalue()


class _File:
    def __init__(self, filename: str | None, data: bytes):
        self.filename = filename
        self._data = data
        self.read_sizes = []

    async def read(self, size: int = -1) -> bytes:
        self.read_sizes.append(size)
        return self._data if size < 0 else self._data[:size]


class _Storage:
    def __init__(self, fail_on_save: int | None = None):
        self.files: dict[str, bytes] = {}
        self.deleted: list[str] = []
        self._fail_on_save = fail_on_save

    async def save(self, key: str, data: bytes) -> None:
        if self._fail_on_save is not None and len(self.files) == self._fail_on_save:
            raise OSError("disk full")
        self.files[key] = data

    async def delete(self, key: str) -> None:
        self.deleted.append(key)
        self.files.pop(key, None)

    def url(self, key: str) -> str:
        return f"/media/{key}"


class _Transaction:
    def __init__(self, db):
        self._db = db

    async def __aenter__(self):
        self._db.events.append("begin")

    async def __aexit__(self, exc_type, exc, tb):
        self._db.events.append("rollback" if exc_type else "commit")
        return False


class _FakeDb:
    def __init__(self):
        self.events = []

    def begin(self):
        return _Transaction(self)


@pytest.fixture
def inserted(monkeypatch):
    calls = []

    async def insert_uploaded_clothing(db, member_id, origin_image_url):
        calls.append((member_id, origin_image_url))
        return 100 + len(calls)

    monkeypatch.setattr(upload.clothing_repo, "insert_uploaded_clothing", insert_uploaded_clothing)
    return calls


@pytest.fixture
def small_limits(monkeypatch):
    monkeypatch.setenv("CLOTHING_UPLOAD_MAX_FILES", "3")
    monkeypatch.setenv("CLOTHING_UPLOAD_MAX_BYTES", str(2 * 1024 * 1024))
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


async def test_valid_files_become_clothing_in_one_transaction(inserted):
    db, storage = _FakeDb(), _Storage()
    files = [_File("a.jpg", _image_bytes()), _File("b.png", _image_bytes("PNG"))]

    result = await upload.upload_clothing(db, storage, 7, files)

    assert db.events == ["begin", "commit"]
    assert [c.clothing_id for c in result.accepted] == [101, 102]
    assert [c.file_name for c in result.accepted] == ["a.jpg", "b.png"]
    assert all(c.processing_status_cd == "processing" for c in result.accepted)
    assert result.rejected == []
    keys = [key for _, key in inserted]
    assert all(key.startswith("clothing/7/") and key.endswith(".webp") for key in keys)
    assert len(set(keys)) == 2
    assert [c.image_url for c in result.accepted] == [f"/media/{key}" for key in keys]
    assert set(storage.files) == set(keys)
    assert all(Image.open(io.BytesIO(d)).format == "WEBP" for d in storage.files.values())


async def test_rejected_files_are_reported_and_others_saved(inserted, small_limits):
    db, storage = _FakeDb(), _Storage()
    files = [
        _File("ok.jpg", _image_bytes()),
        _File("anim.gif", _image_bytes("GIF")),
        _File("big.jpg", b"x" * (2 * 1024 * 1024 + 1)),
    ]

    result = await upload.upload_clothing(db, storage, 7, files)

    assert [c.file_name for c in result.accepted] == ["ok.jpg"]
    assert [(r.file_name, r.reason_cd) for r in result.rejected] == [
        ("anim.gif", "unsupported_format"),
        ("big.jpg", "too_large"),
    ]
    assert result.rejected[1].message == "사진이 너무 큽니다. 2MB 이하로 올려 주세요."
    assert files[2].read_sizes == [2 * 1024 * 1024 + 1]
    assert len(inserted) == 1


async def test_all_rejected_skips_db(inserted):
    db, storage = _FakeDb(), _Storage()

    result = await upload.upload_clothing(db, storage, 7, [_File("x.txt", b"hello")])

    assert result.accepted == []
    assert [r.reason_cd for r in result.rejected] == ["unreadable"]
    assert db.events == []
    assert inserted == []
    assert storage.files == {}


async def test_no_files_is_validation_error(inserted):
    with pytest.raises(NoUploadFilesError):
        await upload.upload_clothing(_FakeDb(), _Storage(), 7, [])


async def test_too_many_files_is_validation_error_before_reading(inserted, small_limits):
    files = [_File(f"{i}.jpg", _image_bytes()) for i in range(4)]

    with pytest.raises(TooManyUploadFilesError) as e:
        await upload.upload_clothing(_FakeDb(), _Storage(), 7, files)

    assert e.value.message == "사진은 한 번에 3장까지 올릴 수 있습니다."
    assert all(f.read_sizes == [] for f in files)


async def test_db_failure_deletes_saved_images(monkeypatch):
    async def insert_uploaded_clothing(db, member_id, origin_image_url):
        raise RuntimeError("db down")

    monkeypatch.setattr(upload.clothing_repo, "insert_uploaded_clothing", insert_uploaded_clothing)
    db, storage = _FakeDb(), _Storage()
    files = [_File("a.jpg", _image_bytes()), _File("b.jpg", _image_bytes())]

    with pytest.raises(RuntimeError):
        await upload.upload_clothing(db, storage, 7, files)

    assert db.events == ["begin", "rollback"]
    assert storage.files == {}
    assert len(storage.deleted) == 2


async def test_storage_failure_deletes_images_saved_before_it(inserted):
    storage = _Storage(fail_on_save=1)
    files = [_File("a.jpg", _image_bytes()), _File("b.jpg", _image_bytes())]

    with pytest.raises(OSError):
        await upload.upload_clothing(_FakeDb(), storage, 7, files)

    assert storage.files == {}
    assert len(storage.deleted) == 1
    assert inserted == []


async def test_cleanup_failure_keeps_original_error(monkeypatch, caplog):
    async def insert_uploaded_clothing(db, member_id, origin_image_url):
        raise RuntimeError("db down")

    class _BrokenDeleteStorage(_Storage):
        async def delete(self, key):
            raise OSError("locked")

    monkeypatch.setattr(upload.clothing_repo, "insert_uploaded_clothing", insert_uploaded_clothing)

    with pytest.raises(RuntimeError, match="db down"):
        await upload.upload_clothing(
            _FakeDb(), _BrokenDeleteStorage(), 7, [_File("a.jpg", _image_bytes())]
        )

    assert "이미지 정리 실패" in caplog.text


async def test_normalization_runs_concurrently_up_to_the_limit(monkeypatch, inserted):
    monkeypatch.setenv("CLOTHING_IMAGE_NORMALIZE_CONCURRENCY", "2")
    get_settings.cache_clear()
    state = {"active": 0, "peak": 0}

    async def slow_read_and_normalize(file, settings):
        state["active"] += 1
        state["peak"] = max(state["peak"], state["active"])
        await asyncio.sleep(0.01)
        state["active"] -= 1
        return b"webp-" + file.filename.encode()

    monkeypatch.setattr(upload, "_read_and_normalize", slow_read_and_normalize)
    files = [_File(f"{i}.jpg", b"") for i in range(5)]
    try:
        result = await upload.upload_clothing(_FakeDb(), _Storage(), 7, files)
    finally:
        get_settings.cache_clear()

    assert state["peak"] == 2
    assert [c.file_name for c in result.accepted] == [f"{i}.jpg" for i in range(5)]


async def test_unexpected_error_while_preparing_is_raised(monkeypatch, inserted):
    async def broken(file, settings):
        raise RuntimeError("thread pool down")

    monkeypatch.setattr(upload, "_read_and_normalize", broken)

    with pytest.raises(RuntimeError, match="thread pool down"):
        await upload.upload_clothing(_FakeDb(), _Storage(), 7, [_File("a.jpg", b"")])

    assert inserted == []
