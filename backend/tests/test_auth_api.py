"""로그인 API 테스트. 제공자와 로그인 서비스는 가짜로 바꿔 끼운다."""

from http.cookies import SimpleCookie
from urllib.parse import parse_qs, urlparse

import pytest
from fastapi.testclient import TestClient

from app.api.auth import OAUTH_STATE_COOKIE, SESSION_COOKIE
from app.core.config import get_settings
from app.core.db import get_db
from app.main import app
from app.services.auth import login as login_service
from app.services.auth.login import LoginResult
from app.services.auth.providers import (
    AuthProviderNotConfiguredError,
    OAuthProviderError,
    get_oauth_provider,
)

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
