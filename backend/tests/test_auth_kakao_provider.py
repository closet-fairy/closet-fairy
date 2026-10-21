"""카카오 로그인 제공자 테스트. 카카오 서버는 가짜 전송 계층으로 바꿔 끼운다."""

import base64
from urllib.parse import parse_qs, urlparse

import httpx
import pytest

from app.core.config import get_settings
from app.services.auth.providers import (
    AuthProviderNotConfiguredError,
    OAuthProviderError,
    get_oauth_provider,
)
from app.services.auth.providers.kakao import TOKEN_URL, USERINFO_URL, KakaoProvider

REDIRECT_URI = "http://localhost:5173/api/auth/kakao/callback"
VALID_KEY = base64.b64encode(bytes(32)).decode()


def _provider(handler) -> KakaoProvider:
    return KakaoProvider("rest-key", "client-secret", 5, transport=httpx.MockTransport(handler))


def _respond(profile):
    def handler(request: httpx.Request) -> httpx.Response:
        if str(request.url) == TOKEN_URL:
            return httpx.Response(200, json={"access_token": "at"})
        return httpx.Response(200, json=profile)

    return handler


def test_authorize_url_asks_only_for_nickname():
    url = urlparse(KakaoProvider("rest-key", "secret", 5).authorize_url("st", REDIRECT_URI))
    query = parse_qs(url.query)

    assert url.netloc == "kauth.kakao.com"
    assert query == {
        "response_type": ["code"],
        "client_id": ["rest-key"],
        "redirect_uri": [REDIRECT_URI],
        "scope": ["profile_nickname"],
        "state": ["st"],
    }


async def test_fetch_identity_exchanges_code_with_secret_and_reads_member_number():
    requests = []
    profile = {"id": 4012345678, "kakao_account": {"profile": {"nickname": "은석"}}}

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return _respond(profile)(request)

    identity = await _provider(handler).fetch_identity("the-code", REDIRECT_URI)

    assert identity.provider_user_id == "4012345678"
    assert identity.nickname == "은석"
    token_form = parse_qs(requests[0].content.decode())
    assert token_form == {
        "grant_type": ["authorization_code"],
        "client_id": ["rest-key"],
        "client_secret": ["client-secret"],
        "redirect_uri": [REDIRECT_URI],
        "code": ["the-code"],
    }
    assert str(requests[1].url) == USERINFO_URL
    assert requests[1].headers["Authorization"] == "Bearer at"


@pytest.mark.parametrize(
    "profile",
    [
        {"id": 1},
        {"id": 1, "kakao_account": {"profile_nickname_needs_agreement": True}},
        {"id": 1, "kakao_account": {"profile": {}}},
        {"id": 1, "kakao_account": None},
    ],
    ids=["no-account", "not-agreed", "no-nickname", "null-account"],
)
async def test_profile_without_nickname_has_no_nickname(profile):
    identity = await _provider(_respond(profile)).fetch_identity("c", REDIRECT_URI)

    assert identity.provider_user_id == "1"
    assert identity.nickname is None


@pytest.mark.parametrize(
    "handler",
    [
        lambda r: httpx.Response(401, json={"error": "invalid_client", "error_code": "KOE010"}),
        lambda r: httpx.Response(200, json={"no_token": True}),
        lambda r: httpx.Response(200, text="not json"),
        _respond({"kakao_account": {}}),
        _respond({"id": None}),
        _respond({"id": 1, "kakao_account": "broken"}),
        _respond([]),
        lambda r: (
            httpx.Response(200, json={"access_token": "at"})
            if str(r.url) == TOKEN_URL
            else httpx.Response(401, json={"code": -401})
        ),
    ],
    ids=[
        "token-rejected",
        "no-access-token",
        "not-json",
        "no-id",
        "null-id",
        "broken-account",
        "not-object",
        "userinfo-rejected",
    ],
)
async def test_unexpected_kakao_responses_become_provider_error(handler):
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


@pytest.mark.parametrize(
    ("rest_api_key", "client_secret"),
    [("", "secret"), ("key", "")],
    ids=["no-rest-api-key", "no-client-secret"],
)
def test_kakao_provider_needs_rest_api_key_and_secret(settings_env, rest_api_key, client_secret):
    settings_env(
        KAKAO_REST_API_KEY=rest_api_key,
        KAKAO_CLIENT_SECRET=client_secret,
        MEMBER_ID_ENCRYPTION_KEY=VALID_KEY,
    )

    with pytest.raises(AuthProviderNotConfiguredError):
        get_oauth_provider("kakao")


def test_kakao_login_is_unavailable_without_valid_encryption_key(settings_env):
    settings_env(
        KAKAO_REST_API_KEY="key", KAKAO_CLIENT_SECRET="secret", MEMBER_ID_ENCRYPTION_KEY=""
    )

    with pytest.raises(AuthProviderNotConfiguredError):
        get_oauth_provider("kakao")


def test_configured_kakao_provider_is_returned(settings_env):
    settings_env(
        KAKAO_REST_API_KEY="key", KAKAO_CLIENT_SECRET="secret", MEMBER_ID_ENCRYPTION_KEY=VALID_KEY
    )

    assert get_oauth_provider("kakao").provider_cd == "kakao"
