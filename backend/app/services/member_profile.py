"""내 정보 조회와 닉네임 수정."""

from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories import member as member_repo
from app.repositories.member import MemberProfile
from app.schemas.member import MemberMe
from app.services.auth.session import AuthRequiredError
from app.services.recommendation_session import from_db_utc


async def get_me(db: AsyncSession, member_id: int) -> MemberMe:
    async with db.begin():
        profile = await member_repo.find_member_profile(db, member_id)
    return _to_response(profile)


async def update_nickname(db: AsyncSession, member_id: int, nickname: str) -> MemberMe:
    async with db.begin():
        await member_repo.update_nickname(db, member_id, nickname)
        profile = await member_repo.find_member_profile(db, member_id)
    return _to_response(profile)


def _to_response(profile: MemberProfile | None) -> MemberMe:
    if profile is None:
        raise AuthRequiredError()
    return MemberMe(
        nickname=profile.nickname,
        provider_cd=profile.provider_cd,
        created_at=from_db_utc(profile.created_at),
        is_onboarded=profile.is_onboarded,
    )
