"""옷 수정 API 테스트. 수정 서비스와 저장소는 가짜로 바꿔 끼운다."""

from datetime import UTC, datetime
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient

from app.api.deps import get_current_member_id
from app.core.db import get_db
from app.main import app
from app.schemas.clothing import ClothingDetail
from app.services import clothing_edit
from app.services.clothing_edit import AccessoryTypeNotAllowedError, ClothingNotEditableError
from app.services.storage import get_image_storage

STORAGE = object()
DETAIL = ClothingDetail(
    clothing_id=5,
    processing_status_cd="completed",
    is_queued=False,
    image_url="/media/clothing/3/a_cutout.webp",
    failure_reason=None,
    is_new=False,
    category_cd="top",
    item_name="셔츠",
    created_at=datetime(2026, 10, 12, tzinfo=UTC),
    origin_image_url="/media/clothing/3/a.webp",
    cutout_image_url="/media/clothing/3/a_cutout.webp",
    accessory_type_cd=None,
    color_cd="white",
    color_text=None,
    thickness_cd=None,
    is_waterproof=None,
    style_cds=[],
    season_cds=[],
    edit=None,
)


@pytest.fixture
def client(monkeypatch):
    calls = []
    outcome = {"error": None}

    def record(name):
        async def fake(db, *args):
            calls.append((name, *args))
            if outcome["error"] is not None:
                raise outcome["error"]
            return None if name == "mark_reviewed" else DETAIL

        return fake

    for name in ["update_clothing", "mark_reviewed", "save_edit", "reset_edit"]:
        monkeypatch.setattr(clothing_edit, name, record(name))

    async def save_mask(db, storage, member_id, clothing_id, file):
        calls.append(("save_mask", storage, member_id, clothing_id, file.read()))
        return DETAIL

    monkeypatch.setattr(clothing_edit, "save_mask", save_mask)

    async def save_display_image(db, storage, member_id, clothing_id, file):
        calls.append(("save_display_image", storage, member_id, clothing_id, file.read()))
        if outcome.get("display_error"):
            raise outcome["display_error"]
        return DETAIL

    monkeypatch.setattr(clothing_edit, "save_display_image", save_display_image)

    async def fake_db():
        yield None

    app.dependency_overrides[get_db] = fake_db
    app.dependency_overrides[get_current_member_id] = lambda: 3
    app.dependency_overrides[get_image_storage] = lambda: STORAGE
    with TestClient(app) as c:
        c.calls = calls
        c.outcome = outcome
        yield c
    app.dependency_overrides.clear()


def test_patch_passes_only_sent_fields(client):
    res = client.patch("/clothing/5", json={"item_name": "셔츠", "thickness_cd": None})

    assert res.status_code == 200
    assert res.json()["clothing_id"] == 5
    [(name, storage, member_id, clothing_id, update)] = client.calls
    assert (name, storage, member_id, clothing_id) == ("update_clothing", STORAGE, 3, 5)
    assert update.model_fields_set == {"item_name", "thickness_cd"}


@pytest.mark.parametrize(
    "body",
    [
        {"category_cd": "hat"},
        {"color_cd": "purple"},
        {"style_cds": ["cool"]},
        {"item_name": "가" * 101},
        {"member_id": 1},
    ],
)
def test_patch_rejects_values_outside_codes(client, body):
    res = client.patch("/clothing/5", json=body)

    assert res.status_code == 422
    assert res.json()["code"] == "VALIDATION_ERROR"
    assert client.calls == []


@pytest.mark.parametrize(
    ("error", "status", "code"),
    [
        (ClothingNotEditableError(), 409, "CLOTHING_NOT_EDITABLE"),
        (AccessoryTypeNotAllowedError(), 422, "CLOTHING_ACCESSORY_TYPE_NOT_ALLOWED"),
    ],
)
def test_patch_maps_service_errors(client, error, status, code):
    client.outcome["error"] = error

    res = client.patch("/clothing/5", json={"accessory_type_cd": "hat"})

    assert res.status_code == status
    assert res.json()["code"] == code


def test_reviewed_returns_no_content(client):
    res = client.post("/clothing/5/reviewed")

    assert res.status_code == 204
    assert res.content == b""
    assert client.calls == [("mark_reviewed", 3, 5)]


def test_put_edit_parses_angle_and_corners(client):
    res = client.put(
        "/clothing/5/edit",
        json={
            "rotation_angle": -90.5,
            "perspective_param": {"corners": [[0, 0], [1, 0], [1, 1], [0, 1]]},
        },
    )

    assert res.status_code == 200
    [(name, _, _, _, edit)] = client.calls
    assert name == "save_edit"
    assert edit.rotation_angle == Decimal("-90.5")
    assert edit.perspective_param.corners[2] == (1, 1)


@pytest.mark.parametrize(
    "body",
    [
        {"rotation_angle": 180.5},
        {"rotation_angle": 1.234},
        {"rotation_angle": 0, "perspective_param": {"corners": [[0, 0], [1, 0], [1, 1]]}},
        {"rotation_angle": 0, "perspective_param": {"corners": [[0, 0], [1.1, 0], [1, 1], [0, 1]]}},
        {},
    ],
)
def test_put_edit_rejects_out_of_range_values(client, body):
    res = client.put("/clothing/5/edit", json=body)

    assert res.status_code == 422
    assert client.calls == []


def test_put_mask_passes_file(client):
    res = client.put("/clothing/5/edit/mask", files={"file": ("m.png", b"png", "image/png")})

    assert res.status_code == 200
    assert client.calls == [("save_mask", STORAGE, 3, 5, b"png")]


def test_delete_edit_resets(client):
    res = client.delete("/clothing/5/edit")

    assert res.status_code == 200
    assert client.calls == [("reset_edit", STORAGE, 3, 5)]


def test_put_display_image_passes_file(client):
    res = client.put("/clothing/5/edit/display", files={"file": ("d.png", b"png", "image/png")})

    assert res.status_code == 200
    assert client.calls == [("save_display_image", STORAGE, 3, 5, b"png")]


def test_put_display_image_rejection_is_422(client):
    error = clothing_edit.InvalidDisplayImageError("사진을 읽을 수 없습니다.")
    client.outcome["display_error"] = error

    res = client.put("/clothing/5/edit/display", files={"file": ("d.png", b"x", "image/png")})

    assert res.status_code == 422
    assert res.json() == {
        "code": "CLOTHING_DISPLAY_IMAGE_INVALID",
        "message": "사진을 읽을 수 없습니다.",
    }
