"""옷 삭제·재시도 API 테스트. 서비스는 가짜로 바꿔 끼운다."""

import pytest
from fastapi.testclient import TestClient

from app.api.deps import get_bg_removal_worker, get_current_member_id
from app.core.db import get_db
from app.main import app
from app.schemas.clothing import ClothingProgress, ClothingUploadResult
from app.services import clothing_delete, clothing_retry, clothing_upload
from app.services.clothing_query import ClothingNotFoundError
from app.services.clothing_rate_limit import RequestRateLimiter, get_clothing_rate_limiter
from app.services.clothing_retry import ClothingNotRetryableError
from app.services.storage import get_image_storage

STORAGE = object()
WORKER = object()
PROGRESS = ClothingProgress(
    clothing_id=5,
    processing_status_cd="processing",
    is_queued=True,
    image_url="/media/clothing/3/a.webp",
    failure_reason=None,
)


@pytest.fixture
def client(monkeypatch):
    calls = []
    outcome = {"error": None}

    async def delete_clothing(db, storage, member_id, clothing_id):
        calls.append(("delete", storage, member_id, clothing_id))
        if outcome["error"]:
            raise outcome["error"]

    async def retry_clothing(db, storage, member_id, clothing_id, worker):
        calls.append(("retry", storage, member_id, clothing_id, worker))
        if outcome["error"]:
            raise outcome["error"]
        return PROGRESS

    async def upload_clothing(db, storage, member_id, files, worker=None):
        calls.append(("upload", member_id))
        return ClothingUploadResult(accepted=[], rejected=[])

    async def fake_db():
        yield None

    monkeypatch.setattr(clothing_delete, "delete_clothing", delete_clothing)
    monkeypatch.setattr(clothing_retry, "retry_clothing", retry_clothing)
    monkeypatch.setattr(clothing_upload, "upload_clothing", upload_clothing)
    app.dependency_overrides[get_db] = fake_db
    app.dependency_overrides[get_current_member_id] = lambda: 3
    app.dependency_overrides[get_image_storage] = lambda: STORAGE
    app.dependency_overrides[get_bg_removal_worker] = lambda: WORKER
    with TestClient(app) as c:
        c.calls = calls
        c.outcome = outcome
        yield c
    app.dependency_overrides.clear()


def test_delete_returns_no_content(client):
    res = client.delete("/clothing/5")

    assert res.status_code == 204
    assert res.content == b""
    assert client.calls == [("delete", STORAGE, 3, 5)]


def test_delete_missing_clothing_is_404(client):
    client.outcome["error"] = ClothingNotFoundError()

    res = client.delete("/clothing/5")

    assert res.status_code == 404
    assert res.json()["code"] == "CLOTHING_NOT_FOUND"


def test_retry_returns_progress_and_passes_worker(client):
    res = client.post("/clothing/5/retry")

    assert res.status_code == 200
    assert res.json()["processing_status_cd"] == "processing"
    assert client.calls == [("retry", STORAGE, 3, 5, WORKER)]


def test_retry_of_unfailed_clothing_is_409(client):
    client.outcome["error"] = ClothingNotRetryableError()

    res = client.post("/clothing/5/retry")

    assert res.status_code == 409
    assert res.json()["code"] == "CLOTHING_NOT_RETRYABLE"


def test_upload_and_retry_share_the_request_limit(client):
    limiter = RequestRateLimiter(2)
    app.dependency_overrides[get_clothing_rate_limiter] = lambda: limiter
    files = [("files", ("a.jpg", b"x", "image/jpeg"))]

    assert client.post("/clothing", files=files).status_code == 202
    assert client.post("/clothing/5/retry").status_code == 200
    res = client.post("/clothing", files=files)

    assert res.status_code == 429
    assert res.json()["code"] == "CLOTHING_TOO_MANY_REQUESTS"
    assert [call[0] for call in client.calls] == ["upload", "retry"]


def test_reads_and_deletes_are_not_limited(client):
    limiter = RequestRateLimiter(0)
    app.dependency_overrides[get_clothing_rate_limiter] = lambda: limiter

    assert client.delete("/clothing/5").status_code == 204
