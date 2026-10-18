"""소셜 로그인: 회원 조회 또는 첫 로그인 가입, 세션 발급 (FR-LOGIN-04, E-3, E-13)."""

import secrets
from dataclasses import dataclass

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.repositories import auth_session as session_repo
from app.repositories import member as member_repo
from app.repositories.member import MemberLogin
from app.services.auth.crypto import (
    encrypt_provider_user_id,
    hash_provider_user_id,
    hash_session_token,
    new_session_token,
)
from app.services.auth.providers import OAuthProvider, ProviderIdentity

NICKNAME_MAX_LENGTH = 30
DEFAULT_NICKNAME_PREFIX = "옷장요정"
MYSQL_DUPLICATE_ENTRY = 1062


@dataclass(frozen=True)
class LoginResult:
    session_token: str
    is_onboarded: bool


async def login_with_provider(
    db: AsyncSession, provider: OAuthProvider, code: str, redirect_uri: str
) -> LoginResult:
    identity = await provider.fetch_identity(code, redirect_uri)
    member = await _find_or_sign_up(db, provider.provider_cd, identity)
    token = new_session_token()
    async with db.begin():
        await session_repo.insert_session(
            db, member.member_id, hash_session_token(token), get_settings().SESSION_TTL_DAYS
        )
    return LoginResult(session_token=token, is_onboarded=member.is_onboarded)


async def _find_or_sign_up(
    db: AsyncSession, provider_cd: str, identity: ProviderIdentity
) -> MemberLogin:
    id_hash = hash_provider_user_id(identity.provider_user_id)
    async with db.begin():
        member = await member_repo.find_member_by_provider(db, provider_cd, id_hash)
    if member is not None:
        return member

    try:
        async with db.begin():
            member_id = await member_repo.insert_member(
                db,
                provider_cd,
                encrypt_provider_user_id(identity.provider_user_id),
                id_hash,
                _nickname(identity.nickname),
            )
    except IntegrityError as e:
        if not _is_duplicate_entry(e):
            raise
        async with db.begin():
            member = await member_repo.find_member_by_provider(db, provider_cd, id_hash)
        if member is None:
            raise
        return member
    return MemberLogin(member_id=member_id, is_onboarded=False)


def _nickname(profile_name: str | None) -> str:
    name = " ".join((profile_name or "").split())[:NICKNAME_MAX_LENGTH].strip()
    return name or f"{DEFAULT_NICKNAME_PREFIX}{secrets.randbelow(10000):04d}"


def _is_duplicate_entry(error: IntegrityError) -> bool:
    args = getattr(error.orig, "args", ())
    return bool(args) and args[0] == MYSQL_DUPLICATE_ENTRY
