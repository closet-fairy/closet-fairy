from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_member_id
from app.core.db import get_db
from app.schemas.clothing_shortage import CategoryCounts, ClothingShortagePrecheckResponse
from app.services.clothing_shortage import precheck_clothing_shortage

router = APIRouter(prefix="/recommendations", tags=["recommendation"])


@router.get("/precheck", response_model=ClothingShortagePrecheckResponse)
async def precheck_recommendation(
    db: AsyncSession = Depends(get_db),
    member_id: int = Depends(get_current_member_id),
) -> ClothingShortagePrecheckResponse:
    """추천 요청 화면 진입 시 의류 부족 사전 안내 (FR-REC-10, FR-REC-14)."""
    precheck = await precheck_clothing_shortage(db, member_id)
    return ClothingShortagePrecheckResponse(
        is_clothing_shortage=precheck.is_clothing_shortage,
        category_counts=CategoryCounts(**precheck.category_counts),
        shortage_categories=precheck.shortage_categories,
        notice_cd=precheck.notice_cd,
    )
