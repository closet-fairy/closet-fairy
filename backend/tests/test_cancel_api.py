"""세션 취소 API 테스트. 취소 서비스는 가짜로 바꿔 끼운다."""

from datetime import datetime

import pytest
from fastapi.testclient import TestClient

from app.api.deps import get_current_member_id, get_now
from app.core.db import get_db
from app.main import app
from app.services import rating_settlement as settlement
from app.services import session_end
from app.services.weather.base_time import KST

FIXED_NOW = datetime(2026, 10, 9, 21, 30, tzinfo=KST)


@pytest.fixture
def client(monkeypatch):
    calls = []
    outcome = {"status": "canceled", "error": None}

    async def fake_cancel_session(db, session_id, member_id, now):
        calls.append((session_id, member_id, now))
        if outcome["error"] is not None:
            raise outcome["error"]
        return outcome["status"]

    async def fake_db():
        yield None

    monkeypatch.setattr(session_end, "cancel_session", fake_cancel_session)
    app.dependency_overrides[get_db] = fake_db
    app.dependency_overrides[get_now] = lambda: FIXED_NOW
    app.dependency_overrides[get_current_member_id] = lambda: 3
    with TestClient(app) as c:
        c.calls = calls
        c.outcome = outcome
        yield c
    app.dependency_overrides.clear()


def test_cancel_returns_200_with_canceled_session(client):
    res = client.post("/recommendation-sessions/7/cancel")

    assert res.status_code == 200
    assert res.json() == {"recommendation_session_id": 7, "session_status_cd": "canceled"}
    assert client.calls == [(7, 3, FIXED_NOW)]


def test_cancel_of_abandoned_session_returns_its_status(client):
    client.outcome["status"] = "abandoned"

    res = client.post("/recommendation-sessions/7/cancel")

    assert res.status_code == 200
    assert res.json()["session_status_cd"] == "abandoned"


@pytest.mark.parametrize(
    ("error", "status_code", "code"),
    [
        (settlement.SessionNotFoundError(), 404, "SESSION_NOT_FOUND"),
        (settlement.SessionAlreadySettledError(), 409, "SESSION_ALREADY_SETTLED"),
    ],
)
def test_service_errors_map_to_status_and_code(client, error, status_code, code):
    client.outcome["error"] = error

    res = client.post("/recommendation-sessions/7/cancel")

    assert res.status_code == status_code
    assert res.json()["code"] == code
