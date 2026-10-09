"""별점 API 테스트. 정산 서비스는 가짜로 바꿔 끼운다."""

from datetime import datetime

import pytest
from fastapi.testclient import TestClient

from app.api.deps import get_current_member_id, get_now
from app.core.db import get_db
from app.main import app
from app.services import rating_settlement as settlement
from app.services.weather.base_time import KST

FIXED_NOW = datetime(2026, 10, 9, 21, 30, tzinfo=KST)


@pytest.fixture
def client(monkeypatch):
    calls = []
    errors = []

    async def fake_rate_and_settle(db, session_id, member_id, outfit_id, rating, now):
        calls.append((session_id, member_id, outfit_id, rating, now))
        if errors:
            raise errors[0]

    async def fake_db():
        yield None

    monkeypatch.setattr(settlement, "rate_and_settle", fake_rate_and_settle)
    app.dependency_overrides[get_db] = fake_db
    app.dependency_overrides[get_now] = lambda: FIXED_NOW
    app.dependency_overrides[get_current_member_id] = lambda: 3
    with TestClient(app) as c:
        c.calls = calls
        c.errors = errors
        yield c
    app.dependency_overrides.clear()


def test_rating_returns_200_with_completed_session(client):
    res = client.post("/recommendation-sessions/7/rating", json={"outfit_id": 102, "rating": 4})

    assert res.status_code == 200
    assert res.json() == {
        "recommendation_session_id": 7,
        "outfit_id": 102,
        "rating": 4,
        "session_status_cd": "completed",
    }
    assert client.calls == [(7, 3, 102, 4, FIXED_NOW)]


@pytest.mark.parametrize(
    "body",
    [
        {"outfit_id": 102, "rating": 0},
        {"outfit_id": 102, "rating": 6},
        {"outfit_id": 102, "rating": 3.5},
        {"outfit_id": 102},
        {"rating": 3},
        {"outfit_id": 0, "rating": 3},
    ],
)
def test_invalid_body_is_422_without_calling_service(client, body):
    res = client.post("/recommendation-sessions/7/rating", json=body)

    assert res.status_code == 422
    assert client.calls == []


@pytest.mark.parametrize(
    ("error", "status_code", "code"),
    [
        (settlement.SessionNotFoundError(), 404, "SESSION_NOT_FOUND"),
        (settlement.OutfitNotInSessionError(), 404, "OUTFIT_NOT_FOUND"),
        (settlement.SessionAlreadySettledError(), 409, "SESSION_ALREADY_SETTLED"),
        (settlement.SessionNotRatableError(), 409, "SESSION_NOT_RATABLE"),
    ],
)
def test_service_errors_map_to_status_codes(client, error, status_code, code):
    client.errors.append(error)

    res = client.post("/recommendation-sessions/7/rating", json={"outfit_id": 102, "rating": 4})

    assert res.status_code == status_code
    assert res.json()["code"] == code
