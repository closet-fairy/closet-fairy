"""탈퇴 서비스 테스트. 리포지토리·제공자·저장소는 가짜로 바꿔 끼운다."""

import logging
from types import SimpleNamespace

import pytest

from app.repositories import clothing as clothing_repo
from app.repositories import member as member_repo
from app.repositories.member import MemberAccount
from app.services.auth import withdrawal
from app.services.auth.crypto import hash_provider_user_id
from app.services.auth.providers import OAuthProviderError, ProviderIdentity
from app.services.auth.session import AuthRequiredError

MEMBER_ID = 3


class _Transaction:
    def __init__(self, events):
        self._events = events

    async def __aenter__(self):
        self._events.append("begin")

    async def __aexit__(self, exc_type, *exc):
        self._events.append("rollback" if exc_type else "commit")
        return False


class _FakeDb:
    def __init__(self, events):
        self._events = events

    def begin(self):
        return _Transaction(self._events)


class _Provider:
    def __init__(self, events, provider_cd="kakao", user_id="kakao-1", revoke_error=None):
        self.provider_cd = provider_cd
        self._events = events
        self._user_id = user_id
        self._revoke_error = revoke_error

    async def fetch_identity(self, code, redirect_uri):
        self._events.append(("fetch", code, redirect_uri))
        return ProviderIdentity(self._user_id, "닉", access_token="at")

    async def revoke(self, access_token):
        self._events.append(("revoke", access_token))
        if self._revoke_error:
            raise self._revoke_error


class _Storage:
    def __init__(self, events, error=None):
        self._events = events
        self._error = error

    async def delete_prefix(self, prefix):
        self._events.append(("delete_prefix", prefix))
        if self._error:
            raise self._error


@pytest.fixture
def env(monkeypatch):
    e = SimpleNamespace(
        events=[],
        account=MemberAccount("kakao", hash_provider_user_id("kakao-1")),
    )

    async def find_member_account(db, member_id):
        e.events.append(("find", member_id))
        return e.account

    async def lock_member_clothing_jobs(db, member_id):
        e.events.append(("lock_jobs", member_id))

    async def delete_member(db, member_id):
        e.events.append(("delete_member", member_id))

    monkeypatch.setattr(member_repo, "find_member_account", find_member_account)
    monkeypatch.setattr(member_repo, "delete_member", delete_member)
    monkeypatch.setattr(clothing_repo, "lock_member_clothing_jobs", lock_member_clothing_jobs)
    e.db = _FakeDb(e.events)
    return e


async def _withdraw(env, provider=None, storage=None):
    await withdrawal.withdraw(
        env.db,
        storage or _Storage(env.events),
        provider or _Provider(env.events),
        MEMBER_ID,
        "the-code",
        "http://cb",
    )


async def test_same_account_is_deleted_then_unlinked_then_files_removed(env):
    await _withdraw(env)

    assert env.events == [
        ("fetch", "the-code", "http://cb"),
        "begin",
        ("find", MEMBER_ID),
        ("lock_jobs", MEMBER_ID),
        ("delete_member", MEMBER_ID),
        "commit",
        ("revoke", "at"),
        ("delete_prefix", f"clothing/{MEMBER_ID}/"),
    ]


@pytest.mark.parametrize(
    "provider_kwargs",
    [{"user_id": "someone-else"}, {"provider_cd": "google", "user_id": "kakao-1"}],
    ids=["other-account", "other-provider"],
)
async def test_other_account_deletes_nothing(env, provider_kwargs):
    with pytest.raises(withdrawal.WithdrawalAccountMismatchError):
        await _withdraw(env, provider=_Provider(env.events, **provider_kwargs))

    assert ("delete_member", MEMBER_ID) not in env.events
    assert not any(e[0] in ("revoke", "delete_prefix") for e in env.events if isinstance(e, tuple))


async def test_failed_relogin_deletes_nothing(env):
    class _Failing(_Provider):
        async def fetch_identity(self, code, redirect_uri):
            raise OAuthProviderError("boom")

    with pytest.raises(OAuthProviderError):
        await _withdraw(env, provider=_Failing(env.events))

    assert env.events == []


async def test_member_already_gone_is_auth_required(env):
    env.account = None

    with pytest.raises(AuthRequiredError):
        await _withdraw(env)

    assert ("delete_member", MEMBER_ID) not in env.events


async def test_unlink_failure_is_logged_and_withdrawal_completes(env, caplog):
    provider = _Provider(env.events, revoke_error=OAuthProviderError("401"))

    with caplog.at_level(logging.WARNING, logger="app.services.auth.withdrawal"):
        await _withdraw(env, provider=provider)

    assert ("delete_member", MEMBER_ID) in env.events
    assert ("delete_prefix", f"clothing/{MEMBER_ID}/") in env.events
    assert [r.message for r in caplog.records] == ["탈퇴 후 소셜 연결 해제 실패"]


async def test_file_cleanup_failure_is_logged_and_withdrawal_completes(env, caplog):
    storage = _Storage(env.events, error=OSError("busy"))

    with caplog.at_level(logging.WARNING, logger="app.services.auth.withdrawal"):
        await _withdraw(env, storage=storage)

    assert ("delete_member", MEMBER_ID) in env.events
    assert [r.message for r in caplog.records] == ["탈퇴 후 이미지 정리 실패"]


async def test_provider_of_member(env):
    assert await withdrawal.provider_cd_of(env.db, MEMBER_ID) == "kakao"

    env.account = None
    with pytest.raises(AuthRequiredError):
        await withdrawal.provider_cd_of(env.db, MEMBER_ID)
