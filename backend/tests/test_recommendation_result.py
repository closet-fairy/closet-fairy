"""REC-17 추천 결과 조회 응답 형식 테스트."""

from datetime import datetime

import pytest
from fastapi.testclient import TestClient

from app.api.deps import get_current_member_id, get_now
from app.core.db import get_db
from app.main import app
from app.schemas.recommendation_result import RecommendationResult
from app.services import recommendation_result as result_service
from app.services.session_errors import SessionNotFoundError

MEMBER_ID = 7
NOW = datetime.fromisoformat("2026-10-14T21:30:00+09:00")


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


@pytest.mark.parametrize("example", RecommendationResult.model_json_schema()["examples"])
def test_schema_examples_are_valid(example):
    RecommendationResult.model_validate(example)


@pytest.fixture
def fake_db():
    async def override():
        yield object()

    app.dependency_overrides[get_db] = override
    app.dependency_overrides[get_current_member_id] = lambda: MEMBER_ID
    app.dependency_overrides[get_now] = lambda: NOW
    yield
    app.dependency_overrides.pop(get_db, None)
    app.dependency_overrides.pop(get_current_member_id, None)
    app.dependency_overrides.pop(get_now, None)


def test_result_endpoint_returns_not_found_in_error_format(client, fake_db, monkeypatch):
    async def missing(db, storage, recommendation_session_id, member_id, now):
        raise SessionNotFoundError()

    monkeypatch.setattr(result_service, "get_recommendation_result", missing)

    response = client.get("/recommendation-sessions/1")

    assert response.status_code == 404
    assert response.json()["code"] == "SESSION_NOT_FOUND"


def test_result_endpoint_returns_service_result(client, fake_db, monkeypatch):
    example = RecommendationResult.model_json_schema()["examples"][0]
    captured = {}

    async def found(db, storage, recommendation_session_id, member_id, now):
        captured.update(session_id=recommendation_session_id, member_id=member_id, now=now)
        return RecommendationResult.model_validate(example)

    monkeypatch.setattr(result_service, "get_recommendation_result", found)

    response = client.get("/recommendation-sessions/12")

    assert response.status_code == 200
    assert response.json()["outfits"][0]["outfit_id"] == example["outfits"][0]["outfit_id"]
    assert captured == {"session_id": 12, "member_id": MEMBER_ID, "now": NOW}


def test_result_schema_is_published_with_enum_values(client):
    spec = client.get("/openapi.json").json()

    operation = spec["paths"]["/recommendation-sessions/{recommendation_session_id}"]["get"]
    assert operation["responses"]["200"]["content"]["application/json"]["schema"]["$ref"].endswith(
        "/RecommendationResult"
    )
    status = spec["components"]["schemas"]["RecommendationResult"]["properties"][
        "generation_status_cd"
    ]
    assert status["enum"] == ["processing", "completed", "failed"]


def test_previous_outfits_and_latest_regeneration_are_published(client):
    schemas = client.get("/openapi.json").json()["components"]["schemas"]

    outfit = schemas["OutfitResult"]
    assert outfit["properties"]["previous_outfits"]["items"]["$ref"].endswith(
        "/PreviousOutfitResult"
    )
    assert "previous_outfits" in outfit["required"]
    previous = schemas["PreviousOutfitResult"]["properties"]
    assert "previous_outfits" not in previous
    assert "outfit_id" in previous

    result = schemas["RecommendationResult"]
    assert "latest_regeneration" in result["required"]
    regeneration = schemas["LatestRegeneration"]["properties"]
    assert regeneration["regeneration_status_cd"]["enum"] == ["processing", "completed", "failed"]
    assert regeneration["target_scope_cd"]["enum"] == ["single", "all"]
