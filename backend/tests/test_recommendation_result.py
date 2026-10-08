"""REC-17 추천 결과 조회 응답 형식 테스트."""

import pytest
from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.core.db import get_db
from app.main import app
from app.schemas.recommendation_result import RecommendationResult
from app.services import recommendation_result as result_service


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
    yield
    app.dependency_overrides.pop(get_db, None)


def test_result_endpoint_returns_not_found_in_error_format(client, fake_db, monkeypatch):
    async def missing(db, recommendation_session_id, member_id):
        raise result_service.RecommendationSessionNotFoundError()

    monkeypatch.setattr(result_service, "get_recommendation_result", missing)

    response = client.get("/recommendation-sessions/1")

    assert response.status_code == 404
    assert response.json()["code"] == "NOT_FOUND"


def test_result_endpoint_returns_service_result(client, fake_db, monkeypatch):
    example = RecommendationResult.model_json_schema()["examples"][0]
    captured = {}

    async def found(db, recommendation_session_id, member_id):
        captured.update(session_id=recommendation_session_id, member_id=member_id)
        return RecommendationResult.model_validate(example)

    monkeypatch.setattr(result_service, "get_recommendation_result", found)

    response = client.get("/recommendation-sessions/12")

    assert response.status_code == 200
    assert response.json()["outfits"][0]["outfit_id"] == example["outfits"][0]["outfit_id"]
    assert captured == {"session_id": 12, "member_id": get_settings().DEV_MEMBER_ID}


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
