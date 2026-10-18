"""Google 로그인 (OAuth 2.0 인가 코드 흐름)."""

from urllib.parse import urlencode

import httpx

from app.services.auth.providers.base import OAuthProviderError, ProviderIdentity

AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URL = "https://oauth2.googleapis.com/token"
USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo"
SCOPE = "openid profile"


class GoogleProvider:
    provider_cd = "google"

    def __init__(
        self,
        client_id: str,
        client_secret: str,
        timeout: float,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self._client_id = client_id
        self._client_secret = client_secret
        self._timeout = timeout
        self._transport = transport

    def authorize_url(self, state: str, redirect_uri: str) -> str:
        query = {
            "response_type": "code",
            "client_id": self._client_id,
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
                        "code": code,
                        "client_id": self._client_id,
                        "client_secret": self._client_secret,
                        "redirect_uri": redirect_uri,
                    },
                )
                token.raise_for_status()
                access_token = token.json()["access_token"]
                userinfo = await client.get(
                    USERINFO_URL, headers={"Authorization": f"Bearer {access_token}"}
                )
                userinfo.raise_for_status()
                profile = userinfo.json()
                provider_user_id = str(profile["sub"])
        except (httpx.HTTPError, ValueError, KeyError, TypeError) as e:
            raise OAuthProviderError(f"Google 로그인 실패: {type(e).__name__}") from e
        return ProviderIdentity(provider_user_id=provider_user_id, nickname=profile.get("name"))
