import logging

from fastapi import status

from app.core.config import get_settings
from app.core.errors import AppError, NotFoundError
from app.services.auth.crypto import EncryptionKeyError, check_encryption_key
from app.services.auth.providers.base import OAuthProvider, OAuthProviderError, ProviderIdentity
from app.services.auth.providers.google import GoogleProvider
from app.services.auth.providers.kakao import KakaoProvider

__all__ = [
    "OAuthProvider",
    "OAuthProviderError",
    "ProviderIdentity",
    "AuthProviderNotFoundError",
    "AuthProviderNotConfiguredError",
    "get_oauth_provider",
]

logger = logging.getLogger(__name__)


class AuthProviderNotFoundError(NotFoundError):
    code = "AUTH_PROVIDER_NOT_FOUND"
    message = "지원하지 않는 로그인 방식입니다."


class AuthProviderNotConfiguredError(AppError):
    code = "AUTH_PROVIDER_NOT_CONFIGURED"
    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    message = "지금은 이 방식으로 로그인할 수 없습니다."


def get_oauth_provider(provider_cd: str) -> OAuthProvider:
    settings = get_settings()
    if provider_cd == GoogleProvider.provider_cd:
        if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
            raise AuthProviderNotConfiguredError()
        _ensure_encryption_key()
        return GoogleProvider(
            settings.GOOGLE_CLIENT_ID, settings.GOOGLE_CLIENT_SECRET, settings.OAUTH_TIMEOUT_S
        )
    if provider_cd == KakaoProvider.provider_cd:
        if not settings.KAKAO_REST_API_KEY or not settings.KAKAO_CLIENT_SECRET:
            raise AuthProviderNotConfiguredError()
        _ensure_encryption_key()
        return KakaoProvider(
            settings.KAKAO_REST_API_KEY, settings.KAKAO_CLIENT_SECRET, settings.OAUTH_TIMEOUT_S
        )
    raise AuthProviderNotFoundError()


def _ensure_encryption_key() -> None:
    try:
        check_encryption_key()
    except EncryptionKeyError as e:
        logger.error("로그인 설정 오류: %s", e)
        raise AuthProviderNotConfiguredError() from e
