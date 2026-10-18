"""소셜 로그인 제공자 공통 형태."""

from dataclasses import dataclass
from typing import Protocol


class OAuthProviderError(Exception):
    pass


@dataclass(frozen=True)
class ProviderIdentity:
    provider_user_id: str
    nickname: str | None


class OAuthProvider(Protocol):
    provider_cd: str

    def authorize_url(self, state: str, redirect_uri: str) -> str: ...

    async def fetch_identity(self, code: str, redirect_uri: str) -> ProviderIdentity: ...
