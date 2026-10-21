"""카카오 로그인 (OAuth 2.0 인가 코드 흐름)."""

from urllib.parse import urlencode

import httpx

from app.services.auth.providers.base import OAuthProviderError, ProviderIdentity

AUTHORIZE_URL = "https://kauth.kakao.com/oauth/authorize"
TOKEN_URL = "https://kauth.kakao.com/oauth/token"
USERINFO_URL = "https://kapi.kakao.com/v2/user/me"
SCOPE = "profile_nickname"


class KakaoProvider:
    provider_cd = "kakao"

    def __init__(
        self,
        rest_api_key: str,
        client_secret: str,
        timeout: float,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self._rest_api_key = rest_api_key
        self._client_secret = client_secret
        self._timeout = timeout
        self._transport = transport

    def authorize_url(self, state: str, redirect_uri: str) -> str:
        query = {
            "response_type": "code",
            "client_id": self._rest_api_key,
            "redirect_uri": redirect_uri,
            "scope": SCOPE,
            "state": state,
        }
        return f"{AUTHORIZE_URL}?{urlencode(query)}"

    async def fetch_identity(self, code: str, redirect_uri: str) -> ProviderIdentity:
        try:
            async with httpx.AsyncClient(
                timeout=self._timeout, transport=self._transport
            ) as client:
                token = await client.post(
                    TOKEN_URL,
                    data={
                        "grant_type": "authorization_code",
                        "client_id": self._rest_api_key,
                        "client_secret": self._client_secret,
                        "redirect_uri": redirect_uri,
                        "code": code,
                    },
                )
                token.raise_for_status()
                access_token = token.json()["access_token"]
                userinfo = await client.get(
                    USERINFO_URL, headers={"Authorization": f"Bearer {access_token}"}
                )
                userinfo.raise_for_status()
                profile = userinfo.json()
                provider_user_id = str(int(profile["id"]))
                account = profile.get("kakao_account") or {}
                nickname = (account.get("profile") or {}).get("nickname")
        except (httpx.HTTPError, ValueError, KeyError, TypeError, AttributeError) as e:
            raise OAuthProviderError(f"카카오 로그인 실패: {type(e).__name__}") from e
        return ProviderIdentity(provider_user_id=provider_user_id, nickname=nickname)
