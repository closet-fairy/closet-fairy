"""로그인 API 테스트. 제공자와 로그인 서비스는 가짜로 바꿔 끼운다."""

from http.cookies import SimpleCookie
from types import SimpleNamespace
from urllib.parse import parse_qs, urlparse

import pytest
from fastapi.testclient import TestClient

from app.api import auth as auth_api
from app.api.auth import OAUTH_STATE_COOKIE, SESSION_COOKIE
from app.api.deps import get_current_member_id
from app.core.config import get_settings
from app.core.db import get_db
from app.main import app
from app.services.auth import login as login_service
from app.services.auth import session as session_service
from app.services.auth import withdrawal as withdrawal_service
from app.services.auth.login import LoginResult
from app.services.auth.providers import (
    AuthProviderNotConfiguredError,
    OAuthProviderError,
    get_oauth_provider,
)
from app.services.auth.session import AuthRequiredError
from app.services.auth.withdrawal import WithdrawalAccountMismatchError

FRONTEND = "http://front.test"
REDIRECT_BASE = "http://front.test/api"


class _Provider:
    provider_cd = "google"

    def authorize_url(self, state, redirect_uri):
        return f"https://accounts.example/auth?state={state}&redirect_uri={redirect_uri}"


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("FRONTEND_BASE_URL", FRONTEND)
    monkeypatch.setenv("OAUTH_REDIRECT_BASE_URL", REDIRECT_BASE)
    monkeypatch.setenv("SESSION_TTL_DAYS", "30")
    monkeypatch.setenv("SESSION_COOKIE_SECURE", "false")
    get_settings.cache_clear()
    calls = []
    outcome = {"result": LoginResult("token-abc", is_onboarded=False), "error": None}

    async def login_with_provider(db, provider, code, redirect_uri):
        calls.append((provider.provider_cd, code, redirect_uri))
        if outcome["error"]:
            raise outcome["error"]
        return outcome["result"]

    async def fake_db():
        yield None

    monkeypatch.setattr(login_service, "login_with_provider", login_with_provider)
    app.dependency_overrides[get_db] = fake_db
    app.dependency_overrides[get_oauth_provider] = _Provider
    with TestClient(app, follow_redirects=False) as c:
        c.calls = calls
        c.outcome = outcome
        yield c
    app.dependency_overrides.clear()
    get_settings.cache_clear()


def _set_cookies(response) -> dict[str, SimpleCookie]:
    cookies = {}
    for header in response.headers.get_list("set-cookie"):
        cookie = SimpleCookie(header)
        for name in cookie:
            cookies[name] = cookie[name]
    return cookies


def _start(client) -> str:
    res = client.get("/auth/google/login")
    return _set_cookies(res)[OAUTH_STATE_COOKIE].value


def test_login_redirects_to_provider_with_state_cookie(client):
    res = client.get("/auth/google/login")

    assert res.status_code == 302
    query = parse_qs(urlparse(res.headers["location"]).query)
    state_cookie = _set_cookies(res)[OAUTH_STATE_COOKIE]
    assert query["state"] == [state_cookie.value]
    assert query["redirect_uri"] == [f"{REDIRECT_BASE}/auth/google/callback"]
    assert state_cookie["httponly"] and state_cookie["samesite"] == "lax"
    assert state_cookie["max-age"] == "600"


def test_each_login_gets_a_new_state(client):
    assert _start(client) != _start(client)


def test_callback_sets_session_cookie_and_sends_new_member_to_onboarding(client):
    state = _start(client)

    res = client.get("/auth/google/callback", params={"code": "c1", "state": state})

    assert res.status_code == 302
    assert res.headers["location"] == f"{FRONTEND}/onboarding"
    cookies = _set_cookies(res)
    session = cookies[SESSION_COOKIE]
    assert session.value == "token-abc"
    assert session["httponly"] and session["samesite"] == "lax" and session["path"] == "/"
    assert session["max-age"] == str(30 * 24 * 60 * 60)
    assert not session["secure"]
    assert cookies[OAUTH_STATE_COOKIE]["max-age"] == "0"
    assert client.calls == [("google", "c1", f"{REDIRECT_BASE}/auth/google/callback")]


def test_onboarded_member_goes_home(client):
    client.outcome["result"] = LoginResult("t", is_onboarded=True)
    state = _start(client)

    res = client.get("/auth/google/callback", params={"code": "c", "state": state})

    assert res.headers["location"] == f"{FRONTEND}/"


def test_secure_cookie_in_deployment(client, monkeypatch):
    monkeypatch.setenv("SESSION_COOKIE_SECURE", "true")
    get_settings.cache_clear()
    state = _start(client)
    client.cookies.set(OAUTH_STATE_COOKIE, state)

    res = client.get("/auth/google/callback", params={"code": "c", "state": state})

    assert _set_cookies(res)[SESSION_COOKIE]["secure"]


@pytest.mark.parametrize(
    "params",
    [
        {"code": "c", "state": "forged"},
        {"code": "c"},
        {"state": "whatever"},
        {"code": "c", "state": "가"},
    ],
    ids=["mismatch", "no-state", "no-code", "non-ascii"],
)
def test_bad_state_or_code_is_rejected(client, params):
    _start(client)

    res = client.get("/auth/google/callback", params=params)

    assert res.headers["location"] == f"{FRONTEND}/login?error=invalid_state"
    assert SESSION_COOKIE not in _set_cookies(res)
    assert client.calls == []


def test_callback_without_state_cookie_is_rejected(client):
    res = client.get("/auth/google/callback", params={"code": "c", "state": "s"})

    assert res.headers["location"] == f"{FRONTEND}/login?error=invalid_state"


@pytest.mark.parametrize(
    ("error", "reason"),
    [("access_denied", "cancelled"), ("server_error", "failed")],
)
def test_provider_error_parameter_ends_login(client, error, reason):
    _start(client)

    res = client.get("/auth/google/callback", params={"error": error})

    assert res.headers["location"] == f"{FRONTEND}/login?error={reason}"
    assert client.calls == []


@pytest.mark.parametrize(
    ("error", "level"),
    [(OAuthProviderError("boom"), "WARNING"), (ConnectionError("db gone"), "ERROR")],
    ids=["provider", "unexpected"],
)
def test_login_failure_redirects_with_failed_and_is_logged(client, caplog, error, level):
    client.outcome["error"] = error
    state = _start(client)

    with caplog.at_level("WARNING", logger="app.api.auth"):
        res = client.get("/auth/google/callback", params={"code": "c", "state": state})

    assert res.headers["location"] == f"{FRONTEND}/login?error=failed"
    assert SESSION_COOKIE not in _set_cookies(res)
    assert [r.levelname for r in caplog.records if r.name == "app.api.auth"] == [level]


def test_unknown_provider_is_404(client):
    app.dependency_overrides.pop(get_oauth_provider)

    res = client.get("/auth/naver/login")

    assert res.status_code == 404
    assert res.json()["code"] == "AUTH_PROVIDER_NOT_FOUND"


def test_unconfigured_provider_is_503(client):
    def not_configured():
        raise AuthProviderNotConfiguredError()

    app.dependency_overrides[get_oauth_provider] = not_configured

    res = client.get("/auth/google/login")

    assert res.status_code == 503
    assert res.json()["code"] == "AUTH_PROVIDER_NOT_CONFIGURED"


@pytest.fixture
def session_calls(monkeypatch):
    calls = []

    async def logout(db, token):
        calls.append(("logout", token))

    async def issue_session(db, member_id):
        calls.append(("issue", member_id))
        return "dev-token"

    monkeypatch.setattr(session_service, "logout", logout)
    monkeypatch.setattr(session_service, "issue_session", issue_session)
    return calls


def test_logout_revokes_session_and_clears_cookie(client, session_calls):
    client.cookies.set(SESSION_COOKIE, "token-abc")

    res = client.post("/auth/logout")

    assert res.status_code == 204
    assert session_calls == [("logout", "token-abc")]
    assert _set_cookies(res)[SESSION_COOKIE]["max-age"] == "0"


def test_logout_without_cookie_still_succeeds(client, session_calls):
    res = client.post("/auth/logout")

    assert res.status_code == 204
    assert session_calls == [("logout", None)]


def test_dev_login_is_hidden_unless_enabled(client, session_calls, monkeypatch):
    monkeypatch.setenv("DEV_AUTH", "false")
    get_settings.cache_clear()

    res = client.get("/auth/dev-login")

    assert res.status_code == 404
    assert session_calls == []


def test_dev_login_issues_session_for_dev_member(client, session_calls, monkeypatch):
    monkeypatch.setenv("DEV_AUTH", "true")
    monkeypatch.setenv("DEV_MEMBER_ID", "5")
    get_settings.cache_clear()

    res = client.get("/auth/dev-login")

    assert res.status_code == 302
    assert res.headers["location"] == f"{FRONTEND}/"
    assert _set_cookies(res)[SESSION_COOKIE].value == "dev-token"
    assert session_calls == [("issue", 5)]


class _WithdrawProvider:
    provider_cd = "kakao"

    def authorize_url(self, state, redirect_uri, *, reauthenticate=False):
        return (
            f"https://kauth.example/auth?state={state}&redirect_uri={redirect_uri}"
            f"&reauth={reauthenticate}"
        )


@pytest.fixture
def withdrawal_calls(client, monkeypatch):
    calls = SimpleNamespace(withdrawn=[], member_id=3, error=None)

    async def provider_cd_of(db, member_id):
        return "kakao"

    async def authenticate(db, token):
        if token != "session-token":
            raise AuthRequiredError()
        return calls.member_id

    async def withdraw(db, storage, provider, member_id, code, redirect_uri):
        if calls.error:
            raise calls.error
        calls.withdrawn.append((provider.provider_cd, member_id, code, redirect_uri))

    monkeypatch.setattr(withdrawal_service, "provider_cd_of", provider_cd_of)
    monkeypatch.setattr(withdrawal_service, "withdraw", withdraw)
    monkeypatch.setattr(session_service, "authenticate", authenticate)
    monkeypatch.setattr(auth_api, "get_oauth_provider", lambda provider_cd: _WithdrawProvider())
    app.dependency_overrides[get_oauth_provider] = _WithdrawProvider
    app.dependency_overrides[get_current_member_id] = lambda: calls.member_id
    return calls


def _start_withdrawal(client) -> str:
    res = client.post("/auth/withdraw")
    return _set_cookies(res)[OAUTH_STATE_COOKIE].value


def test_withdrawal_starts_with_forced_relogin_at_members_provider(client, withdrawal_calls):
    res = client.post("/auth/withdraw")

    assert res.status_code == 200
    query = parse_qs(urlparse(res.json()["authorize_url"]).query)
    state = _set_cookies(res)[OAUTH_STATE_COOKIE].value
    assert state.startswith("w.")
    assert query["state"] == [state]
    assert query["redirect_uri"] == [f"{REDIRECT_BASE}/auth/kakao/callback"]
    assert query["reauth"] == ["True"]


def test_withdrawal_needs_login(client):
    res = client.post("/auth/withdraw")

    assert res.status_code == 401
    assert res.json()["code"] == "AUTH_REQUIRED"


def test_withdrawal_cannot_be_started_by_navigation(client, withdrawal_calls):
    res = client.get("/auth/withdraw")

    assert res.status_code == 405
    assert OAUTH_STATE_COOKIE not in _set_cookies(res)


def test_same_account_relogin_withdraws_and_clears_session(client, withdrawal_calls):
    state = _start_withdrawal(client)
    client.cookies.set(SESSION_COOKIE, "session-token")

    res = client.get("/auth/kakao/callback", params={"code": "c1", "state": state})

    assert res.headers["location"] == f"{FRONTEND}/login?withdrawn=1"
    cookies = _set_cookies(res)
    assert cookies[SESSION_COOKIE]["max-age"] == "0"
    assert cookies[OAUTH_STATE_COOKIE]["max-age"] == "0"
    assert withdrawal_calls.withdrawn == [
        ("kakao", 3, "c1", f"{REDIRECT_BASE}/auth/kakao/callback")
    ]
    assert client.calls == []


@pytest.mark.parametrize(
    ("error", "reason"),
    [
        (WithdrawalAccountMismatchError(), "account_mismatch"),
        (OAuthProviderError("boom"), "failed"),
        (ConnectionError("db gone"), "failed"),
    ],
    ids=["other-account", "provider", "unexpected"],
)
def test_withdrawal_failure_keeps_account(client, withdrawal_calls, error, reason):
    withdrawal_calls.error = error
    state = _start_withdrawal(client)
    client.cookies.set(SESSION_COOKIE, "session-token")

    res = client.get("/auth/kakao/callback", params={"code": "c1", "state": state})

    assert res.headers["location"] == f"{FRONTEND}/my-info?withdraw_error={reason}"
    assert SESSION_COOKIE not in _set_cookies(res)


def test_withdrawal_without_session_is_failed(client, withdrawal_calls):
    state = _start_withdrawal(client)

    res = client.get("/auth/kakao/callback", params={"code": "c1", "state": state})

    assert res.headers["location"] == f"{FRONTEND}/my-info?withdraw_error=failed"
    assert withdrawal_calls.withdrawn == []


def test_cancelled_withdrawal_returns_to_my_info(client, withdrawal_calls):
    state = _start_withdrawal(client)

    res = client.get("/auth/kakao/callback", params={"error": "access_denied", "state": state})

    assert res.headers["location"] == f"{FRONTEND}/my-info?withdraw_error=cancelled"
    assert withdrawal_calls.withdrawn == []


def test_forged_withdrawal_state_is_rejected(client, withdrawal_calls):
    _start_withdrawal(client)
    client.cookies.set(SESSION_COOKIE, "session-token")

    res = client.get("/auth/kakao/callback", params={"code": "c1", "state": "w.forged"})

    assert res.headers["location"] == f"{FRONTEND}/my-info?withdraw_error=invalid_state"
    assert withdrawal_calls.withdrawn == []


def test_normal_login_after_abandoned_withdrawal_is_still_login(client, withdrawal_calls):
    _start_withdrawal(client)
    state = _start(client)

    res = client.get("/auth/google/callback", params={"code": "c", "state": state})

    assert res.headers["location"] == f"{FRONTEND}/onboarding"
    assert withdrawal_calls.withdrawn == []
