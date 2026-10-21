"""계정 탈퇴. 다시 로그인한 계정이 본인일 때만 지운다 (#100, Q9)."""

import logging

from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories import clothing as clothing_repo
from app.repositories import member as member_repo
from app.services.auth.crypto import hash_provider_user_id
from app.services.auth.providers import OAuthProvider
from app.services.auth.session import AuthRequiredError
from app.services.storage import ImageStorage

logger = logging.getLogger(__name__)


class WithdrawalAccountMismatchError(Exception):
    pass


async def provider_cd_of(db: AsyncSession, member_id: int) -> str:
    async with db.begin():
        account = await member_repo.find_member_account(db, member_id)
    if account is None:
        raise AuthRequiredError()
    return account.provider_cd


async def withdraw(
    db: AsyncSession,
    storage: ImageStorage,
    provider: OAuthProvider,
    member_id: int,
    code: str,
    redirect_uri: str,
) -> None:
    identity = await provider.fetch_identity(code, redirect_uri)
    async with db.begin():
        account = await member_repo.find_member_account(db, member_id)
        if account is None:
            raise AuthRequiredError()
        if (
            account.provider_cd != provider.provider_cd
            or account.provider_user_id_hash != hash_provider_user_id(identity.provider_user_id)
        ):
            raise WithdrawalAccountMismatchError()
        await clothing_repo.lock_member_clothing_jobs(db, member_id)
        await member_repo.delete_member(db, member_id)

    try:
        await provider.revoke(identity.access_token)
    except Exception:
        logger.warning(
            "탈퇴 후 소셜 연결 해제 실패",
            exc_info=True,
            extra={"member_id": member_id, "provider_cd": provider.provider_cd},
        )

    try:
        await storage.delete_prefix(f"clothing/{member_id}/")
    except Exception:
        logger.warning("탈퇴 후 이미지 정리 실패", exc_info=True, extra={"member_id": member_id})
