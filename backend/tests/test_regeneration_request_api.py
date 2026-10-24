"""재추천 요청 API 테스트. 접수 서비스는 가짜로 바꿔 끼운다."""

from datetime import datetime

import pytest
from fastapi.testclient import TestClient

from app.api import recommendation_session as session_api
from app.api.deps import get_current_member_id, get_now
from app.core.db import get_db
from app.main import app
from app.services import regeneration_request as service
from app.services import session_errors
from app.services.llm import get_llm_client
from app.services.weather.base_time import KST

FIXED_NOW = datetime(2026, 10, 14, 21, 30, tzinfo=KST)
FAKE_LLM = object()
URL = "/recommendation-sessions/7/regenerations"


@pytest.fixture
def client(monkeypatch):
    calls = []
    pipeline_calls = []
    outcome = {"error": None}

    async def fake_request_regeneration(db, llm, session_id, member_id, req, now):
        calls.append((llm, session_id, member_id, req, now))
        if outcome["error"] is not None:
            raise outcome["error"]
        return service.AcceptedRegeneration(regeneration_request_id=55, request_seq=2)

    async def fake_run_pipeline(regeneration_request_id, llm):
        pipeline_calls.append((regeneration_request_id, llm))

    async def fake_db():
        yield None

    monkeypatch.setattr(service, "request_regeneration", fake_request_regeneration)
    monkeypatch.setattr(session_api, "run_regeneration_pipeline", fake_run_pipeline)
    app.dependency_overrides[get_db] = fake_db
    app.dependency_overrides[get_now] = lambda: FIXED_NOW
    app.dependency_overrides[get_current_member_id] = lambda: 3
    app.dependency_overrides[get_llm_client] = lambda: FAKE_LLM
    with TestClient(app) as c:
        c.calls = calls
        c.pipeline_calls = pipeline_calls
        c.outcome = outcome
        yield c
    app.dependency_overrides.clear()


def test_accepted_request_returns_202_with_processing_status(client):
    res = client.post(
        URL,
        json={
            "request_text": "좀 더 캐주얼하게",
            "target_scope_cd": "single",
            "target_outfit_id": 101,
            "target_slot_cd": "shoes",
        },
    )

    assert res.status_code == 202
    assert res.json() == {
        "recommendation_session_id": 7,
        "regeneration_request_id": 55,
        "request_seq": 2,
        "regeneration_status_cd": "processing",
    }
    ((llm, session_id, member_id, req, now),) = client.calls
    assert (llm, session_id, member_id, now) == (FAKE_LLM, 7, 3, FIXED_NOW)
    assert (req.target_scope_cd, req.target_outfit_id, req.target_slot_cd) == (
        "single",
        101,
        "shoes",
    )


def test_accepted_request_starts_generation_in_background(client):
    res = client.post(URL, json={"request_text": "전체 다시", "target_scope_cd": "all"})

    assert res.status_code == 202
    assert client.pipeline_calls == [(55, FAKE_LLM)]


def test_all_scope_needs_no_target(client):
    res = client.post(URL, json={"request_text": "전체 다시", "target_scope_cd": "all"})

    assert res.status_code == 202


@pytest.mark.parametrize(
    "body",
    [
        {"request_text": "다시", "target_scope_cd": "single"},
        {"request_text": "다시", "target_scope_cd": "single", "target_slot_cd": "shoes"},
        {"request_text": "다시", "target_scope_cd": "all", "target_outfit_id": 101},
        {"request_text": "다시", "target_scope_cd": "all", "target_slot_cd": "shoes"},
        {"request_text": "다시", "target_scope_cd": "single", "target_outfit_id": 0},
        {
            "request_text": "다시",
            "target_scope_cd": "single",
            "target_outfit_id": 1,
            "target_slot_cd": "hat",
        },
        {"request_text": "다시", "target_scope_cd": "some"},
        {"target_scope_cd": "all"},
    ],
    ids=[
        "single_without_outfit",
        "slot_without_outfit",
        "all_with_outfit",
        "all_with_slot",
        "outfit_id_zero",
        "unknown_slot",
        "unknown_scope",
        "missing_text",
    ],
)
def test_invalid_target_is_validation_error(client, body):
    res = client.post(URL, json=body)

    assert res.status_code == 422
    assert res.json()["code"] == "VALIDATION_ERROR"
    assert client.calls == []


def test_long_text_reaches_service_for_distinct_code(client):
    client.outcome["error"] = service.RegenerationRequestTooLongError(300)

    res = client.post(URL, json={"request_text": "가" * 301, "target_scope_cd": "all"})

    assert res.status_code == 422
    assert res.json() == {
        "code": "REGENERATION_REQUEST_TOO_LONG",
        "message": "요청은 300자까지 입력할 수 있습니다. 조금 줄여서 다시 입력해 주세요.",
    }
    assert client.calls[0][3].request_text == "가" * 301


@pytest.mark.parametrize(
    ("error", "status_code", "code"),
    [
        (service.RegenerationRequestHarmfulError(), 422, "REGENERATION_REQUEST_HARMFUL"),
        (service.RegenerationRequestUnclearError(), 422, "REGENERATION_REQUEST_UNCLEAR"),
        (service.RegenerationTargetNotLatestError(), 422, "REGENERATION_TARGET_NOT_LATEST"),
        (service.RegenerationInProgressError(), 409, "REGENERATION_IN_PROGRESS"),
        (session_errors.SessionNotReadyError(), 409, "SESSION_NOT_READY"),
        (session_errors.SessionAlreadySettledError(), 409, "SESSION_ALREADY_SETTLED"),
        (session_errors.SessionEndedError(), 409, "SESSION_ENDED"),
        (session_errors.SessionNotFoundError(), 404, "SESSION_NOT_FOUND"),
        (session_errors.OutfitNotInSessionError(), 404, "OUTFIT_NOT_FOUND"),
        (service.RegenerationIntentUnavailableError(), 503, "REGENERATION_INTENT_UNAVAILABLE"),
    ],
)
def test_service_errors_map_to_status_and_code(client, error, status_code, code):
    client.outcome["error"] = error

    res = client.post(URL, json={"request_text": "다시", "target_scope_cd": "all"})

    assert res.status_code == status_code
    assert res.json()["code"] == code


def test_openapi_documents_success_body_and_error_statuses():
    operation = app.openapi()["paths"][
        "/recommendation-sessions/{recommendation_session_id}/regenerations"
    ]["post"]

    success = operation["responses"]["202"]["content"]["application/json"]["schema"]
    assert success == {"$ref": "#/components/schemas/RegenerationCreated"}
    assert {"404", "409", "422", "503"} <= operation["responses"].keys()
