from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_member_id
from app.core.db import get_db
from app.schemas.recommendation_history import RecommendationHistoryPage
from app.services import recommendation_history as history_service
from app.services.storage import ImageStorage, get_image_storage

router = APIRouter(prefix="/recommendation-history", tags=["recommendation"])


@router.get("", response_model=RecommendationHistoryPage)
async def list_recommendation_history(
    cursor: int | None = Query(default=None, ge=1, description="이전 응답의 next_cursor"),
    limit: int = Query(default=20, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    member_id: int = Depends(get_current_member_id),
    storage: ImageStorage = Depends(get_image_storage),
) -> RecommendationHistoryPage:
    """추천 내역 목록. 별점을 매겨 끝난 추천만 최근 추천부터 limit개씩 나눠 준다 (무한 스크롤)."""
    return await history_service.get_history_page(db, storage, member_id, cursor, limit)
