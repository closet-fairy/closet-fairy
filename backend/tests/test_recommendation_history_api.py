"""#173·#174 추천 내역 목록·상세 API 테스트. 서비스와 저장소는 가짜로 바꿔 끼운다."""

import pytest
from fastapi.testclient import TestClient

from app.api.deps import get_current_member_id
from app.core.db import get_db
from app.main import app
from app.schemas.recommendation_history import (
    RecommendationHistoryDetail,
    RecommendationHistoryPage,
)
from app.services import recommendation_history as history_service
from app.services.session_errors import SessionNotFoundError
from app.services.storage import get_image_storage

MEMBER_ID = 7
STORAGE = object()
EXAMPLE = RecommendationHistoryPage.model_json_schema()["examples"][0]
DETAIL_EXAMPLE = RecommendationHistoryDetail.model_json_schema()["examples"][0]


@pytest.fixture
def client(monkeypatch):
    calls = []
    detail_calls = []
    state = {"detail_error": None}

    async def get_history_page(db, storage, member_id, cursor, limit):
        calls.append((storage, member_id, cursor, limit))
        return RecommendationHistoryPage.model_validate(EXAMPLE)

    async def get_history_detail(db, storage, member_id, recommendation_session_id):
        detail_calls.append((storage, member_id, recommendation_session_id))
        if state["detail_error"] is not None:
            raise state["detail_error"]
        return RecommendationHistoryDetail.model_validate(DETAIL_EXAMPLE)

    async def fake_db():
        yield None

    monkeypatch.setattr(history_service, "get_history_page", get_history_page)
    monkeypatch.setattr(history_service, "get_history_detail", get_history_detail)
    app.dependency_overrides[get_db] = fake_db
    app.dependency_overrides[get_current_member_id] = lambda: MEMBER_ID
    app.dependency_overrides[get_image_storage] = lambda: STORAGE
    with TestClient(app) as c:
        c.calls = calls
        c.detail_calls = detail_calls
        c.state = state
        yield c
    app.dependency_overrides.clear()


@pytest.mark.parametrize("example", RecommendationHistoryPage.model_json_schema()["examples"])
def test_schema_examples_are_valid(example):
    RecommendationHistoryPage.model_validate(example)


def test_list_passes_cursor_and_default_limit(client):
    cursor = EXAMPLE["next_cursor"]

    res = client.get("/recommendation-history", params={"cursor": cursor})

    assert res.status_code == 200
    assert res.json() == EXAMPLE
    assert client.calls == [(STORAGE, MEMBER_ID, cursor, 20)]


def test_list_without_cursor_passes_none(client):
    limit = 50

    client.get("/recommendation-history", params={"limit": limit})

    assert client.calls == [(STORAGE, MEMBER_ID, None, limit)]


@pytest.mark.parametrize("params", [{"limit": 0}, {"limit": 51}, {"cursor": 0}])
def test_list_rejects_out_of_range_params(client, params):
    res = client.get("/recommendation-history", params=params)

    assert res.status_code == 422
    assert client.calls == []


def test_history_is_published_with_auth_response(client):
    spec = client.get("/openapi.json").json()

    operation = spec["paths"]["/recommendation-history"]["get"]
    assert operation["responses"]["200"]["content"]["application/json"]["schema"]["$ref"].endswith(
        "/RecommendationHistoryPage"
    )
    assert "401" in operation["responses"]
    assert operation["tags"] == ["recommendation"]


@pytest.mark.parametrize("example", RecommendationHistoryDetail.model_json_schema()["examples"])
def test_detail_schema_examples_are_valid(example):
    RecommendationHistoryDetail.model_validate(example)


def test_detail_passes_session_id(client):
    session_id = DETAIL_EXAMPLE["recommendation_session_id"]

    res = client.get(f"/recommendation-history/{session_id}")

    assert res.status_code == 200
    assert res.json() == DETAIL_EXAMPLE
    assert client.detail_calls == [(STORAGE, MEMBER_ID, session_id)]
    assert client.calls == []


def test_detail_not_found_is_404(client):
    client.state["detail_error"] = SessionNotFoundError()

    res = client.get("/recommendation-history/41")

    assert res.status_code == 404
    assert res.json()["code"] == "SESSION_NOT_FOUND"


def test_detail_is_published_with_auth_and_not_found_responses(client):
    spec = client.get("/openapi.json").json()

    operation = spec["paths"]["/recommendation-history/{recommendation_session_id}"]["get"]
    assert operation["responses"]["200"]["content"]["application/json"]["schema"]["$ref"].endswith(
        "/RecommendationHistoryDetail"
    )
    assert {"401", "404"} <= set(operation["responses"])
    assert operation["tags"] == ["recommendation"]
