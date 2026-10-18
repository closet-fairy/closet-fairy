"""제공자 고유 ID 암호화·해시와 세션 토큰 테스트."""

import base64
import hashlib

import pytest
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from app.core.config import get_settings
from app.services.auth import crypto

KEY = bytes(range(32))


@pytest.fixture
def encryption_key(monkeypatch):
    monkeypatch.setenv("MEMBER_ID_ENCRYPTION_KEY", base64.b64encode(KEY).decode())
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def test_encrypted_provider_id_decrypts_with_the_key(encryption_key):
    encrypted = crypto.encrypt_provider_user_id("google-sub-123")

    nonce, ciphertext = encrypted[: crypto.NONCE_BYTES], encrypted[crypto.NONCE_BYTES :]
    assert AESGCM(KEY).decrypt(nonce, ciphertext, None) == b"google-sub-123"
    assert b"google-sub-123" not in encrypted


def test_same_provider_id_encrypts_differently_each_time(encryption_key):
    assert crypto.encrypt_provider_user_id("same") != crypto.encrypt_provider_user_id("same")


def test_provider_id_hash_is_stable_sha256():
    assert crypto.hash_provider_user_id("abc") == hashlib.sha256(b"abc").digest()
    assert len(crypto.hash_provider_user_id("abc")) == 32


@pytest.mark.parametrize(
    "key",
    ["", "not base64!", base64.b64encode(b"short").decode()],
)
def test_bad_encryption_key_is_rejected(monkeypatch, key):
    monkeypatch.setenv("MEMBER_ID_ENCRYPTION_KEY", key)
    get_settings.cache_clear()
    try:
        with pytest.raises(crypto.EncryptionKeyError):
            crypto.encrypt_provider_user_id("x")
    finally:
        get_settings.cache_clear()


def test_session_tokens_are_random_and_stored_as_hash():
    first, second = crypto.new_session_token(), crypto.new_session_token()

    assert first != second
    assert crypto.hash_session_token(first) == hashlib.sha256(first.encode()).digest()
