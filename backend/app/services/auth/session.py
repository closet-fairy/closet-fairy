"""인증 세션 발급·확인·무효화 (E-13, FR-LOGOUT-02)."""

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.errors import UnauthorizedError
from app.repositories import auth_session as session_repo
from app.services.auth.crypto import hash_session_token, new_session_token


class AuthRequiredError(UnauthorizedError):
    code = "AUTH_REQUIRED"
    message = "로그인이 필요합니다."


async def issue_session(db: AsyncSession, member_id: int) -> str:
    token = new_session_token()
    async with db.begin():
        await session_repo.insert_session(
            db, member_id, hash_session_token(token), get_settings().SESSION_TTL_DAYS
        )
    return token


async def authenticate(db: AsyncSession, token: str | None) -> int:
    if not token:
        raise AuthRequiredError()
    async with db.begin():
        member_id = await session_repo.find_active_session_member(db, hash_session_token(token))
    if member_id is None:
        raise AuthRequiredError()
    return member_id


async def logout(db: AsyncSession, token: str | None) -> None:
    if not token:
        return
    async with db.begin():
        await session_repo.revoke_session(db, hash_session_token(token))
