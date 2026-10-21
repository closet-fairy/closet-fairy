"""세션 쿠키로 회원을 확인하는 공통 의존성 테스트."""

import pytest
from fastapi.testclient import TestClient

from app.api.auth import SESSION_COOKIE
from app.core.db import get_db
from app.main import app
from app.repositories import auth_session as session_repo
from app.services.auth.crypto import hash_session_token


class _Transaction:
    async def __aenter__(self):
        return None

    async def __aexit__(self, *exc):
        return False


class _FakeDb:
    def begin(self):
        return _Transaction()


@pytest.fixture
def client(monkeypatch):
    sessions = {hash_session_token("valid"): 3}

    async def find_active_session_member(db, token_hash):
        return sessions.get(token_hash)

    async def fake_db():
        yield _FakeDb()

    monkeypatch.setattr(session_repo, "find_active_session_member", find_active_session_member)
    app.dependency_overrides[get_db] = fake_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.mark.parametrize("cookie", [None, "expired-or-revoked"], ids=["no-cookie", "invalid"])
def test_member_apis_need_a_valid_session(client, cookie):
    if cookie:
        client.cookies.set(SESSION_COOKIE, cookie)

    res = client.get("/clothing/status", params={"ids": "1"})

    assert res.status_code == 401
    assert res.json() == {"code": "AUTH_REQUIRED", "message": "로그인이 필요합니다."}


def test_valid_session_reaches_the_api_as_its_member(client, monkeypatch):
    from app.services import clothing_query

    received = []

    async def get_clothing_status(db, storage, member_id, clothing_ids):
        received.append(member_id)
        return {"items": []}

    monkeypatch.setattr(clothing_query, "get_clothing_status", get_clothing_status)
    client.cookies.set(SESSION_COOKIE, "valid")

    res = client.get("/clothing/status", params={"ids": "1"})

    assert res.status_code == 200
    assert received == [3]


def test_openapi_documents_401_only_on_member_apis():
    from app.main import app

    paths = app.openapi()["paths"]
    for path, operations in paths.items():
        needs_login = path.startswith(("/clothing", "/recommendation"))
        for operation in operations.values():
            assert ("401" in operation["responses"]) == needs_login, path
    response = paths["/clothing"]["get"]["responses"]["401"]
    assert response["content"]["application/json"]["schema"] == {
        "$ref": "#/components/schemas/ErrorResponse"
    }
