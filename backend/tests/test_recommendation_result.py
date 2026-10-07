"""REC-17 추천 결과 조회 응답 형식 테스트."""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.schemas.recommendation_result import RecommendationResult


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


@pytest.mark.parametrize("example", RecommendationResult.model_json_schema()["examples"])
def test_schema_examples_are_valid(example):
    RecommendationResult.model_validate(example)


def test_result_endpoint_returns_not_implemented_in_error_format(client):
    response = client.get("/recommendation-sessions/1")

    assert response.status_code == 501
    assert response.json()["code"] == "NOT_IMPLEMENTED"


def test_result_schema_is_published_with_enum_values(client):
    spec = client.get("/openapi.json").json()

    operation = spec["paths"]["/recommendation-sessions/{recommendation_session_id}"]["get"]
    assert operation["responses"]["200"]["content"]["application/json"]["schema"]["$ref"].endswith(
        "/RecommendationResult"
    )
    status = spec["components"]["schemas"]["RecommendationResult"]["properties"][
        "generation_status"
    ]
    assert status["enum"] == ["processing", "completed", "failed"]
