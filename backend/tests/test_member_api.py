"""내 정보 API 테스트. 리포지토리는 가짜로 바꿔 끼운다."""

from datetime import datetime
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from app.api.deps import get_current_member_id
from app.core.db import get_db
from app.main import app
from app.repositories import member as member_repo
from app.repositories.member import MemberProfile

MEMBER_ID = 7


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
    r = SimpleNamespace(
        profile=MemberProfile(
            nickname="은석",
            provider_cd="kakao",
            created_at=datetime(2026, 10, 21, 16, 50),
            is_onboarded=False,
        ),
        looked_up=[],
        updated=[],
    )

    async def find_member_profile(db, member_id):
        r.looked_up.append(member_id)
        return r.profile

    async def update_nickname(db, member_id, nickname):
        r.updated.append((member_id, nickname))
        r.profile = MemberProfile(
            nickname, r.profile.provider_cd, r.profile.created_at, r.profile.is_onboarded
        )

    async def fake_db():
        yield _FakeDb()

    monkeypatch.setattr(member_repo, "find_member_profile", find_member_profile)
    monkeypatch.setattr(member_repo, "update_nickname", update_nickname)
    app.dependency_overrides[get_db] = fake_db
    app.dependency_overrides[get_current_member_id] = lambda: MEMBER_ID
    with TestClient(app) as c:
        c.repo = r
        yield c
    app.dependency_overrides.clear()


def test_me_returns_own_profile_with_join_time_in_kst(client):
    res = client.get("/members/me")

    assert res.status_code == 200
    assert res.json() == {
        "nickname": "은석",
        "provider_cd": "kakao",
        "created_at": "2026-10-22T01:50:00+09:00",
        "is_onboarded": False,
    }
    assert client.repo.looked_up == [MEMBER_ID]


@pytest.mark.parametrize(
    ("sent", "saved"),
    [("  새 닉네임  ", "새 닉네임"), ("가", "가"), ("가" * 30, "가" * 30), ("　요정\t", "요정")],
    ids=["trimmed", "one-char", "thirty-chars", "unicode-space"],
)
def test_nickname_is_trimmed_and_saved_for_own_account(client, sent, saved):
    res = client.patch("/members/me", json={"nickname": sent})

    assert res.status_code == 200
    assert res.json()["nickname"] == saved
    assert client.repo.updated == [(MEMBER_ID, saved)]


@pytest.mark.parametrize("nickname", ["", "   ", "가" * 31], ids=["empty", "blank", "too-long"])
def test_invalid_nickname_is_422_with_guide(client, nickname):
    res = client.patch("/members/me", json={"nickname": nickname})

    assert res.status_code == 422
    assert res.json() == {
        "code": "VALIDATION_ERROR",
        "message": "닉네임은 1~30자로 입력해 주세요.",
    }
    assert client.repo.updated == []


@pytest.mark.parametrize(
    "body",
    [{}, {"nickname": None}, {"nickname": 1}, {"nickname": "닉", "member_id": 99}],
    ids=["missing", "null", "not-string", "member-id"],
)
def test_malformed_body_is_422(client, body):
    res = client.patch("/members/me", json=body)

    assert res.status_code == 422
    assert client.repo.updated == []


def test_member_gone_after_login_is_401(client):
    client.repo.profile = None

    res = client.get("/members/me")

    assert res.status_code == 401
    assert res.json()["code"] == "AUTH_REQUIRED"


@pytest.mark.parametrize("method", ["GET", "PATCH"])
def test_me_needs_login(method):
    with TestClient(app) as c:
        res = c.request(method, "/members/me", json={"nickname": "닉"})

    assert res.status_code == 401
    assert res.json()["code"] == "AUTH_REQUIRED"
