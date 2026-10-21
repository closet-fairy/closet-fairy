from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_member_id
from app.core.db import get_db
from app.schemas.member import MemberMe, MemberUpdate
from app.services import member_profile

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
