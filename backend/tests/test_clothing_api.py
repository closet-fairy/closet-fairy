"""옷 업로드 API 테스트. 업로드 서비스와 저장소는 가짜로 바꿔 끼운다."""

import pytest
from fastapi.testclient import TestClient

from app.api.deps import get_bg_removal_worker, get_current_member_id
from app.core.config import get_settings
from app.core.db import get_db
from app.main import app
from app.schemas.clothing import ClothingUploadResult, RejectedUpload, UploadedClothing
from app.services import clothing_upload
from app.services.clothing_upload import TooManyUploadFilesError
from app.services.storage import get_image_storage

STORAGE = object()


@pytest.fixture
def client(monkeypatch):
    calls = []
    outcome = {"error": None}

    async def fake_upload_clothing(db, storage, member_id, files):
        calls.append(
            (storage, member_id, [(f.filename, await f.read(), f.content_type) for f in files])
        )
        if outcome["error"] is not None:
            raise outcome["error"]
        return ClothingUploadResult(
            accepted=[
                UploadedClothing(
                    clothing_id=31,
                    processing_status_cd="processing",
                    image_url="/media/clothing/3/a.webp",
                    file_name="a.jpg",
                )
            ],
            rejected=[
                RejectedUpload(
                    file_name="b.gif",
                    reason_cd="unsupported_format",
                    message="JPG, PNG, WEBP, HEIC 사진만 올릴 수 있습니다.",
                )
            ],
        )

    async def fake_db():
        yield None

    monkeypatch.setattr(clothing_upload, "upload_clothing", fake_upload_clothing)
    app.dependency_overrides[get_db] = fake_db
    app.dependency_overrides[get_current_member_id] = lambda: 3
    app.dependency_overrides[get_image_storage] = lambda: STORAGE
    with TestClient(app) as c:
        c.calls = calls
        c.outcome = outcome
        yield c
    app.dependency_overrides.clear()


def test_upload_returns_202_with_accepted_and_rejected(client):
    res = client.post(
        "/clothing",
        files=[
            ("files", ("a.jpg", b"jpeg-bytes", "image/jpeg")),
            ("files", ("b.gif", b"gif-bytes", "image/gif")),
        ],
    )

    assert res.status_code == 202
    assert res.json() == {
        "accepted": [
            {
                "clothing_id": 31,
                "processing_status_cd": "processing",
                "image_url": "/media/clothing/3/a.webp",
                "file_name": "a.jpg",
            }
        ],
        "rejected": [
            {
                "file_name": "b.gif",
                "reason_cd": "unsupported_format",
                "message": "JPG, PNG, WEBP, HEIC 사진만 올릴 수 있습니다.",
            }
        ],
    }
    assert client.calls == [
        (
            STORAGE,
            3,
            [("a.jpg", b"jpeg-bytes", "image/jpeg"), ("b.gif", b"gif-bytes", "image/gif")],
        )
    ]


def test_upload_without_files_is_422(client):
    res = client.post("/clothing", data={"other": "x"})

    assert res.status_code == 422
    assert res.json()["code"] == "VALIDATION_ERROR"
    assert client.calls == []


def test_service_validation_error_keeps_code_and_message(client):
    client.outcome["error"] = TooManyUploadFilesError("사진은 한 번에 20장까지 올릴 수 있습니다.")

    res = client.post("/clothing", files=[("files", ("a.jpg", b"x", "image/jpeg"))])

    assert res.status_code == 422
    assert res.json() == {
        "code": "CLOTHING_TOO_MANY_FILES",
        "message": "사진은 한 번에 20장까지 올릴 수 있습니다.",
    }


def test_media_files_are_served(client):
    media_root = get_settings().MEDIA_ROOT
    target = media_root / "test-served.txt"
    target.write_bytes(b"hello")
    try:
        res = client.get("/media/test-served.txt")
    finally:
        target.unlink()

    assert res.status_code == 200
    assert res.content == b"hello"


def test_missing_media_file_is_not_found_in_error_format(client):
    res = client.get("/media/clothing/0/missing.webp")

    assert res.status_code == 404
    assert res.json()["code"] == "NOT_FOUND"


class _FakeWorker:
    def __init__(self):
        self.notified = 0

    def notify(self):
        self.notified += 1


@pytest.mark.parametrize(("accepted", "expected"), [(True, 1), (False, 0)])
def test_upload_wakes_worker_only_when_created(client, monkeypatch, accepted, expected):
    worker = _FakeWorker()
    app.dependency_overrides[get_bg_removal_worker] = lambda: worker
    if not accepted:

        async def all_rejected(db, storage, member_id, files):
            return ClothingUploadResult(accepted=[], rejected=[])

        monkeypatch.setattr(clothing_upload, "upload_clothing", all_rejected)

    res = client.post("/clothing", files=[("files", ("a.jpg", b"x", "image/jpeg"))])

    assert res.status_code == 202
    assert worker.notified == expected


def test_upload_works_without_worker(client):
    res = client.post("/clothing", files=[("files", ("a.jpg", b"x", "image/jpeg"))])

    assert res.status_code == 202
