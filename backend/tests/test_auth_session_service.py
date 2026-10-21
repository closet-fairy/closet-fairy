"""세션 발급·확인·무효화 테스트. 리포지토리는 가짜로 바꿔 끼운다."""

from types import SimpleNamespace

import pytest

from app.core.config import get_settings
from app.repositories import auth_session as session_repo
from app.services.auth import session
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
def repo(monkeypatch):
    r = SimpleNamespace(members={}, inserted=[], revoked=[])

    async def find_active_session_member(db, token_hash):
        return r.members.get(token_hash)

    async def insert_session(db, member_id, token_hash, ttl_days):
        r.inserted.append((member_id, token_hash, ttl_days))

    async def revoke_session(db, token_hash):
        r.revoked.append(token_hash)

    monkeypatch.setattr(session_repo, "find_active_session_member", find_active_session_member)
    monkeypatch.setattr(session_repo, "insert_session", insert_session)
    monkeypatch.setattr(session_repo, "revoke_session", revoke_session)
    return r


async def test_issue_session_stores_only_the_hash(repo, monkeypatch):
    monkeypatch.setenv("SESSION_TTL_DAYS", "30")
    get_settings.cache_clear()

    token = await session.issue_session(_FakeDb(), 7)

    assert repo.inserted == [(7, hash_session_token(token), 30)]
    get_settings.cache_clear()


async def test_active_session_returns_its_member(repo):
    repo.members[hash_session_token("tok")] = 7

    assert await session.authenticate(_FakeDb(), "tok") == 7


@pytest.mark.parametrize("token", [None, "", "unknown-or-expired"])
async def test_missing_or_invalid_session_requires_login(repo, token):
    with pytest.raises(session.AuthRequiredError):
        await session.authenticate(_FakeDb(), token)


async def test_logout_revokes_by_hash(repo):
    await session.logout(_FakeDb(), "tok")

    assert repo.revoked == [hash_session_token("tok")]


async def test_logout_without_token_does_nothing(repo):
    await session.logout(_FakeDb(), None)

    assert repo.revoked == []
