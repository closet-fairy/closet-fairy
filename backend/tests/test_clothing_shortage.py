from typing import get_args

import pytest
from fastapi.testclient import TestClient

from app.api.deps import get_current_member_id
from app.core.db import get_db
from app.main import app
from app.repositories import clothing as clothing_repo
from app.schemas.clothing_shortage import (
    CategoryCounts,
    ClothingShortageNoticeCd,
    ShortageCategory,
)
from app.services.clothing_shortage import (
    CLOTHING_SHORTAGE_NOTICE_CD,
    SHORTAGE_CHECK_CATEGORIES,
    judge_clothing_shortage,
)


@pytest.fixture
def client_with_counts(monkeypatch):
    calls = []

    def make(counts):
        async def fake_count(db, member_id, category_cds):
            calls.append({"member_id": member_id, "category_cds": tuple(category_cds)})
            return {category_cd: counts.get(category_cd, 0) for category_cd in category_cds}

        monkeypatch.setattr(clothing_repo, "count_completed_by_category", fake_count)
        client = TestClient(app)
        client.calls = calls
        return client

    async def fake_db():
        yield None

    app.dependency_overrides[get_db] = fake_db
    app.dependency_overrides[get_current_member_id] = lambda: 7
    yield make
    app.dependency_overrides.clear()


def test_precheck_empty_closet(client_with_counts):
    client = client_with_counts({})
    res = client.get("/recommendations/precheck")
    assert res.status_code == 200
    assert res.json() == {
        "is_clothing_shortage": True,
        "category_counts": {"top": 0, "bottom": 0, "shoes": 0},
        "shortage_categories": ["top", "bottom", "shoes"],
        "notice_cd": "clothing_shortage",
    }
    assert client.calls == [{"member_id": 7, "category_cds": ("top", "bottom", "shoes")}]


def test_precheck_only_tops(client_with_counts):
    client = client_with_counts({"top": 3})
    res = client.get("/recommendations/precheck")
    assert res.status_code == 200
    assert res.json() == {
        "is_clothing_shortage": True,
        "category_counts": {"top": 3, "bottom": 0, "shoes": 0},
        "shortage_categories": ["bottom", "shoes"],
        "notice_cd": "clothing_shortage",
    }


def test_precheck_enough_clothing(client_with_counts):
    client = client_with_counts({"top": 2, "bottom": 4, "shoes": 2})
    res = client.get("/recommendations/precheck")
    assert res.status_code == 200
    assert res.json() == {
        "is_clothing_shortage": False,
        "category_counts": {"top": 2, "bottom": 4, "shoes": 2},
        "shortage_categories": [],
        "notice_cd": None,
    }


def test_judge_one_item_is_shortage():
    result = judge_clothing_shortage({"top": 2, "bottom": 1, "shoes": 2})
    assert result.is_clothing_shortage is True
    assert result.shortage_categories == ["bottom"]
    assert result.notice_cd == "clothing_shortage"


def test_judge_two_items_is_not_shortage():
    result = judge_clothing_shortage({"top": 2, "bottom": 2, "shoes": 2})
    assert result.is_clothing_shortage is False
    assert result.shortage_categories == []
    assert result.notice_cd is None


def test_response_schema_matches_service_constants():
    assert get_args(ShortageCategory) == SHORTAGE_CHECK_CATEGORIES
    assert tuple(CategoryCounts.model_fields) == SHORTAGE_CHECK_CATEGORIES
    assert get_args(ClothingShortageNoticeCd) == (CLOTHING_SHORTAGE_NOTICE_CD,)
