"""Google 로그인 제공자 테스트. Google 서버는 가짜 전송 계층으로 바꿔 끼운다."""

import base64
from urllib.parse import parse_qs, urlparse

import httpx
import pytest

from app.core.config import get_settings
from app.services.auth.providers import (
    AuthProviderNotConfiguredError,
    AuthProviderNotFoundError,
    OAuthProviderError,
    get_oauth_provider,
)
from app.services.auth.providers.google import TOKEN_URL, USERINFO_URL, GoogleProvider

REDIRECT_URI = "http://localhost:5173/api/auth/google/callback"
VALID_KEY = base64.b64encode(bytes(32)).decode()


def _provider(handler) -> GoogleProvider:
    return GoogleProvider("client-id", "client-secret", 5, transport=httpx.MockTransport(handler))


def test_authorize_url_asks_only_for_openid_profile():
    url = urlparse(GoogleProvider("client-id", "secret", 5).authorize_url("st", REDIRECT_URI))
    query = parse_qs(url.query)

    assert url.netloc == "accounts.google.com"
    assert query == {
        "response_type": ["code"],
        "client_id": ["client-id"],
        "redirect_uri": [REDIRECT_URI],
        "scope": ["openid profile"],
        "state": ["st"],
    }


async def test_fetch_identity_exchanges_code_and_reads_profile():
    requests = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        if str(request.url) == TOKEN_URL:
            return httpx.Response(200, json={"access_token": "at"})
        return httpx.Response(200, json={"sub": "1234567890", "name": "은석"})

    identity = await _provider(handler).fetch_identity("the-code", REDIRECT_URI)

    assert identity.provider_user_id == "1234567890"
    assert identity.nickname == "은석"
    token_form = parse_qs(requests[0].content.decode())
    assert token_form["code"] == ["the-code"]
    assert token_form["redirect_uri"] == [REDIRECT_URI]
    assert token_form["grant_type"] == ["authorization_code"]
    assert str(requests[1].url) == USERINFO_URL
    assert requests[1].headers["Authorization"] == "Bearer at"


async def test_profile_without_name_has_no_nickname():
    def handler(request):
        if str(request.url) == TOKEN_URL:
            return httpx.Response(200, json={"access_token": "at"})
        return httpx.Response(200, json={"sub": "1"})

    identity = await _provider(handler).fetch_identity("c", REDIRECT_URI)

    assert identity.nickname is None


@pytest.mark.parametrize(
    "handler",
    [
        lambda r: httpx.Response(400, json={"error": "invalid_grant"}),
        lambda r: httpx.Response(200, json={"no_token": True}),
        lambda r: httpx.Response(200, text="not json"),
        lambda r: (
            httpx.Response(200, json={"access_token": "at"})
            if str(r.url) == TOKEN_URL
            else httpx.Response(200, json={"name": "no sub"})
        ),
    ],
    ids=["token-rejected", "no-access-token", "not-json", "no-sub"],
)
async def test_unexpected_google_responses_become_provider_error(handler):
    with pytest.raises(OAuthProviderError):
        await _provider(handler).fetch_identity("c", REDIRECT_URI)


async def test_network_failure_becomes_provider_error():
    def handler(request):
        raise httpx.ConnectTimeout("timeout", request=request)

    with pytest.raises(OAuthProviderError):
        await _provider(handler).fetch_identity("c", REDIRECT_URI)


@pytest.fixture
def settings_env(monkeypatch):
    def apply(**values):
        for key, value in values.items():
            monkeypatch.setenv(key, value)
        get_settings.cache_clear()

    yield apply
    get_settings.cache_clear()


def test_google_provider_needs_client_id_and_secret(settings_env):
    settings_env(GOOGLE_CLIENT_ID="id", GOOGLE_CLIENT_SECRET="", MEMBER_ID_ENCRYPTION_KEY=VALID_KEY)

    with pytest.raises(AuthProviderNotConfiguredError):
        get_oauth_provider("google")


@pytest.mark.parametrize("key", ["", "not base64!", base64.b64encode(b"short").decode()])
def test_login_is_unavailable_without_valid_encryption_key(settings_env, key):
    settings_env(GOOGLE_CLIENT_ID="id", GOOGLE_CLIENT_SECRET="secret", MEMBER_ID_ENCRYPTION_KEY=key)

    with pytest.raises(AuthProviderNotConfiguredError):
        get_oauth_provider("google")


def test_configured_google_provider_is_returned(settings_env):
    settings_env(
        GOOGLE_CLIENT_ID="id", GOOGLE_CLIENT_SECRET="secret", MEMBER_ID_ENCRYPTION_KEY=VALID_KEY
    )

    assert get_oauth_provider("google").provider_cd == "google"


def test_unknown_provider_is_not_found():
    with pytest.raises(AuthProviderNotFoundError):
        get_oauth_provider("naver")
