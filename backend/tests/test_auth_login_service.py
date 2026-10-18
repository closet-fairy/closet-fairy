"""로그인 서비스 테스트. 리포지토리와 제공자는 가짜로 바꿔 끼운다."""

import base64
from types import SimpleNamespace

import pytest
from sqlalchemy.exc import IntegrityError

from app.core.config import get_settings
from app.repositories import auth_session as session_repo
from app.repositories import member as member_repo
from app.repositories.member import MemberLogin
from app.services.auth import login
from app.services.auth.crypto import hash_provider_user_id, hash_session_token
from app.services.auth.providers import OAuthProviderError, ProviderIdentity


class _Transaction:
    def __init__(self, db):
        self._db = db

    async def __aenter__(self):
        return None

    async def __aexit__(self, exc_type, *exc):
        if exc_type is None:
            self._db.commits += 1
        return False


class _FakeDb:
    def __init__(self):
        self.commits = 0

    def begin(self):
        return _Transaction(self)


class _Provider:
    provider_cd = "google"

    def __init__(self, identity=None, error=None):
        self._identity = identity or ProviderIdentity("sub-1", "은석")
        self._error = error
        self.calls = []

    async def fetch_identity(self, code, redirect_uri):
        self.calls.append((code, redirect_uri))
        if self._error:
            raise self._error
        return self._identity


def _duplicate_entry() -> IntegrityError:
    return IntegrityError("INSERT", {}, Exception(1062, "Duplicate entry"))


@pytest.fixture(autouse=True)
def settings(monkeypatch):
    monkeypatch.setenv("MEMBER_ID_ENCRYPTION_KEY", base64.b64encode(bytes(32)).decode())
    monkeypatch.setenv("SESSION_TTL_DAYS", "30")
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


@pytest.fixture
def repo(monkeypatch):
    r = SimpleNamespace(found=[None], inserted=[], sessions=[], insert_error=None)

    async def find_member_by_provider(db, provider_cd, id_hash):
        return r.found.pop(0) if len(r.found) > 1 else r.found[0]

    async def insert_member(db, provider_cd, enc, id_hash, nickname):
        if r.insert_error:
            raise r.insert_error
        r.inserted.append((provider_cd, enc, id_hash, nickname))
        return 42

    async def insert_session(db, member_id, token_hash, ttl_days):
        r.sessions.append((member_id, token_hash, ttl_days))

    monkeypatch.setattr(member_repo, "find_member_by_provider", find_member_by_provider)
    monkeypatch.setattr(member_repo, "insert_member", insert_member)
    monkeypatch.setattr(session_repo, "insert_session", insert_session)
    return r


async def test_first_login_signs_up_and_issues_session(repo):
    provider = _Provider()
    db = _FakeDb()

    result = await login.login_with_provider(db, provider, "code", "http://cb")

    [(provider_cd, enc, id_hash, nickname)] = repo.inserted
    assert provider_cd == "google"
    assert id_hash == hash_provider_user_id("sub-1")
    assert b"sub-1" not in enc
    assert nickname == "은석"
    assert repo.sessions == [(42, hash_session_token(result.session_token), 30)]
    assert result.is_onboarded is False
    assert provider.calls == [("code", "http://cb")]
    assert db.commits == 3


async def test_returning_member_is_not_signed_up_again(repo):
    repo.found = [MemberLogin(member_id=7, is_onboarded=True)]

    result = await login.login_with_provider(_FakeDb(), _Provider(), "code", "http://cb")

    assert repo.inserted == []
    assert repo.sessions[0][0] == 7
    assert result.is_onboarded is True


async def test_concurrent_first_login_uses_the_member_that_won(repo):
    repo.found = [None, MemberLogin(member_id=9, is_onboarded=False)]
    repo.insert_error = _duplicate_entry()

    result = await login.login_with_provider(_FakeDb(), _Provider(), "code", "http://cb")

    assert repo.sessions[0][0] == 9
    assert result.is_onboarded is False


async def test_other_integrity_errors_are_not_swallowed(repo):
    repo.insert_error = IntegrityError("INSERT", {}, Exception(1452, "FK fails"))

    with pytest.raises(IntegrityError):
        await login.login_with_provider(_FakeDb(), _Provider(), "code", "http://cb")

    assert repo.sessions == []


async def test_provider_failure_creates_nothing(repo):
    provider = _Provider(error=OAuthProviderError("boom"))

    with pytest.raises(OAuthProviderError):
        await login.login_with_provider(_FakeDb(), provider, "code", "http://cb")

    assert repo.inserted == [] and repo.sessions == []


@pytest.mark.parametrize(
    ("profile_name", "expected"),
    [
        ("  오  은석 ", "오 은석"),
        ("가" * 40, "가" * 30),
    ],
)
async def test_nickname_comes_from_profile_name(repo, profile_name, expected):
    await login.login_with_provider(
        _FakeDb(), _Provider(ProviderIdentity("sub-1", profile_name)), "c", "http://cb"
    )

    assert repo.inserted[0][3] == expected


@pytest.mark.parametrize("profile_name", [None, "", "   "])
async def test_missing_profile_name_gets_default_nickname(repo, profile_name):
    await login.login_with_provider(
        _FakeDb(), _Provider(ProviderIdentity("sub-1", profile_name)), "c", "http://cb"
    )

    nickname = repo.inserted[0][3]
    assert nickname.startswith("옷장요정") and len(nickname) == len("옷장요정") + 4
