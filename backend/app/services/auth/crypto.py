"""제공자 고유 ID 암호화·해시와 세션 토큰 (FR-LOGIN-04, E-13)."""

import base64
import hashlib
import secrets

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from app.core.config import get_settings

NONCE_BYTES = 12
KEY_BYTES = 32
SESSION_TOKEN_BYTES = 32
OAUTH_STATE_BYTES = 32


class EncryptionKeyError(RuntimeError):
    pass


def check_encryption_key() -> None:
    _encryption_key()


def encrypt_provider_user_id(provider_user_id: str) -> bytes:
    nonce = secrets.token_bytes(NONCE_BYTES)
    return nonce + AESGCM(_encryption_key()).encrypt(nonce, provider_user_id.encode(), None)


def hash_provider_user_id(provider_user_id: str) -> bytes:
    return hashlib.sha256(provider_user_id.encode()).digest()


def new_session_token() -> str:
    return secrets.token_urlsafe(SESSION_TOKEN_BYTES)


def hash_session_token(token: str) -> bytes:
    return hashlib.sha256(token.encode()).digest()


def new_oauth_state() -> str:
    return secrets.token_urlsafe(OAUTH_STATE_BYTES)


def _encryption_key() -> bytes:
    try:
        key = base64.b64decode(get_settings().MEMBER_ID_ENCRYPTION_KEY, validate=True)
    except ValueError as e:
        raise EncryptionKeyError("MEMBER_ID_ENCRYPTION_KEY는 base64로 적어야 합니다.") from e
    if len(key) != KEY_BYTES:
        raise EncryptionKeyError("MEMBER_ID_ENCRYPTION_KEY는 32바이트(AES-256) 키여야 합니다.")
    return key
