from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_member_id, get_now
from app.core.db import get_db
from app.schemas.member import MemberMe, MemberSettings, MemberSettingsUpdate, MemberUpdate
from app.services import member_profile, member_settings

router = APIRouter(prefix="/members", tags=["member"])


@router.get("/me", response_model=MemberMe)
async def get_me(
    db: AsyncSession = Depends(get_db),
    member_id: int = Depends(get_current_member_id),
) -> MemberMe:
    """로그인한 회원 본인의 정보."""
    return await member_profile.get_me(db, member_id)


@router.patch("/me", response_model=MemberMe)
async def update_me(
    update: MemberUpdate,
    db: AsyncSession = Depends(get_db),
    member_id: int = Depends(get_current_member_id),
) -> MemberMe:
    """닉네임 수정. 앞뒤 공백을 지운 뒤 1~30자가 아니면 422."""
    return await member_profile.update_nickname(db, member_id, update.nickname)


@router.get("/me/settings", response_model=MemberSettings)
async def get_my_settings(
    db: AsyncSession = Depends(get_db),
    member_id: int = Depends(get_current_member_id),
) -> MemberSettings:
    """개인 설정. 온보딩 전이면 출생연도가 null이다."""
    return await member_settings.get_member_settings(db, member_id)


@router.put("/me/settings", response_model=MemberSettings)
async def save_my_settings(
    update: MemberSettingsUpdate,
    db: AsyncSession = Depends(get_db),
    member_id: int = Depends(get_current_member_id),
    now: datetime = Depends(get_now),
) -> MemberSettings:
    """개인 설정 저장 (온보딩·내 정보 공용). 출생연도가 있으면 온보딩이 완료된다.

    선호 스타일을 처음 고른 저장에서만 그 스타일들의 선호 점수에 +5를 준다.
    """
    return await member_settings.save_member_settings(db, member_id, update, now)
