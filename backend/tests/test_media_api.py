"""옷 이미지 제공 테스트. 로그인한 회원 자신의 이미지만 열린다."""

import pytest
from fastapi.testclient import TestClient

from app.api.deps import get_current_member_id
from app.core.config import get_settings
from app.main import app
from app.services.auth.session import AuthRequiredError

MEMBER_ID = 3


@pytest.fixture
def client():
    media_root = get_settings().MEDIA_ROOT
    created = []

    def put_image(key, data=b"img"):
        path = media_root / key
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        created.append(path)

    app.dependency_overrides[get_current_member_id] = lambda: MEMBER_ID
    with TestClient(app) as c:
        c.put_image = put_image
        yield c
    app.dependency_overrides.clear()
    get_settings.cache_clear()
    for path in created:
        path.unlink(missing_ok=True)


def test_own_image_is_served_privately(client):
    client.put_image(f"clothing/{MEMBER_ID}/test-own.webp", b"mine")

    res = client.get(f"/media/clothing/{MEMBER_ID}/test-own.webp")

    assert res.status_code == 200
    assert res.content == b"mine"
    assert res.headers["cache-control"] == "private, max-age=3600"
    assert res.headers["etag"]


def test_unchanged_image_is_revalidated_with_304(client):
    client.put_image(f"clothing/{MEMBER_ID}/test-own.webp", b"mine")
    url = f"/media/clothing/{MEMBER_ID}/test-own.webp"
    etag = client.get(url).headers["etag"]

    res = client.get(url, headers={"If-None-Match": etag})

    assert res.status_code == 304
    assert res.content == b""
    assert res.headers["etag"] == etag


def test_other_members_image_is_not_found(client):
    client.put_image("clothing/99/test-other.webp")

    res = client.get("/media/clothing/99/test-other.webp")

    assert res.status_code == 404
    assert res.json()["code"] == "NOT_FOUND"


@pytest.mark.parametrize(
    "path",
    [
        f"/media/clothing/{MEMBER_ID}/missing.webp",
        f"/media/clothing/{MEMBER_ID}/../99/test-other.webp",
        f"/media/clothing/{MEMBER_ID}/%2e%2e/99/test-other.webp",
        f"/media/clothing/{MEMBER_ID}/%2E%2E%2F99%2Ftest-other.webp",
        f"/media/clothing/{MEMBER_ID}/%2e%2e/%2e%2e/%2e%2e/etc/passwd",
        f"/media/clothing/{MEMBER_ID}/",
        f"/media/clothing/{MEMBER_ID}/test-own.webp/child.webp",
        f"/media/clothing/{MEMBER_ID}/{'a' * 300}.webp",
    ],
    ids=[
        "missing",
        "dot-dot",
        "encoded-dot-dot",
        "encoded-slash",
        "outside-root",
        "directory",
        "under-a-file",
        "name-too-long",
    ],
)
def test_missing_or_escaping_paths_are_not_found(client, path):
    client.put_image("clothing/99/test-other.webp")
    client.put_image(f"clothing/{MEMBER_ID}/test-own.webp")

    res = client.get(path)

    assert res.status_code == 404


def test_essential_item_images_are_shared(client):
    client.put_image("essential/test-21.png", b"shared")

    res = client.get("/media/essential/test-21.png")

    assert res.status_code == 200
    assert res.content == b"shared"


@pytest.mark.parametrize("folder", ["dev-seed", "dev-seed-sparse"])
@pytest.mark.parametrize(("dev_auth", "status"), [("true", 200), ("false", 404)])
def test_dev_seed_images_only_with_dev_auth(client, monkeypatch, folder, dev_auth, status):
    monkeypatch.setenv("DEV_AUTH", dev_auth)
    get_settings.cache_clear()
    client.put_image(f"{folder}/test-seed.png")

    res = client.get(f"/media/{folder}/test-seed.png")

    assert res.status_code == status


def test_images_need_login(client):
    def not_logged_in():
        raise AuthRequiredError()

    app.dependency_overrides[get_current_member_id] = not_logged_in
    client.put_image(f"clothing/{MEMBER_ID}/test-own.webp")

    res = client.get(f"/media/clothing/{MEMBER_ID}/test-own.webp")

    assert res.status_code == 401
    assert res.json()["code"] == "AUTH_REQUIRED"
