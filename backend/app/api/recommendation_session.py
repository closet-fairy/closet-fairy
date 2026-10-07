from datetime import datetime

from fastapi import APIRouter, BackgroundTasks, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_member_id, get_now
from app.core.db import get_db
from app.schemas.recommendation_session import (
    RecommendationSessionCreate,
    RecommendationSessionCreated,
)
from app.services import recommendation_session as session_service
from app.services.llm import LLMClient, get_llm_client
from app.services.recommendation_pipeline import run_recommendation_pipeline

router = APIRouter(prefix="/recommendation-sessions", tags=["recommendation"])


@router.post("", status_code=status.HTTP_202_ACCEPTED, response_model=RecommendationSessionCreated)
async def create_recommendation_session(
    body: RecommendationSessionCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    member_id: int = Depends(get_current_member_id),
    now: datetime = Depends(get_now),
    llm: LLMClient = Depends(get_llm_client),
) -> RecommendationSessionCreated:
    """추천 요청. 세션만 만들고 바로 202를 돌려준다. 결과는 폴링으로 조회."""
    session_id = await session_service.create_session(db, member_id, body, now)
    background_tasks.add_task(run_recommendation_pipeline, session_id, llm)
    return RecommendationSessionCreated(
        recommendation_session_id=session_id, session_status_cd="active"
    )
