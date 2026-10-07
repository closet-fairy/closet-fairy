from datetime import datetime

from fastapi import APIRouter, BackgroundTasks, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_member_id, get_now
from app.core.db import get_db
from app.core.errors import AppError
from app.schemas.recommendation_result import RecommendationResult
from app.schemas.recommendation_session import (
    RecommendationSessionCreate,
    RecommendationSessionCreated,
)
from app.services import recommendation_session as session_service
from app.services.recommendation_pipeline import run_recommendation_pipeline

router = APIRouter(prefix="/recommendation-sessions", tags=["recommendation"])


@router.post("", status_code=status.HTTP_202_ACCEPTED, response_model=RecommendationSessionCreated)
async def create_recommendation_session(
    body: RecommendationSessionCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    member_id: int = Depends(get_current_member_id),
    now: datetime = Depends(get_now),
) -> RecommendationSessionCreated:
    """추천 요청. 세션만 만들고 바로 202를 돌려준다. 결과는 폴링으로 조회."""
    session_id = await session_service.create_session(db, member_id, body, now)
    background_tasks.add_task(run_recommendation_pipeline, session_id)
    return RecommendationSessionCreated(
        recommendation_session_id=session_id, session_status_cd="active"
    )


class ResultNotImplementedError(AppError):
    code = "NOT_IMPLEMENTED"
    status_code = status.HTTP_501_NOT_IMPLEMENTED
    message = "추천 결과 조회는 아직 구현되지 않았습니다."


@router.get(
    "/{recommendation_session_id}",
    response_model=RecommendationResult,
    responses={
        404: {"description": "없는 세션이거나 본인 세션이 아님"},
        501: {"description": "구현 전 (응답 형식만 먼저 공개)"},
    },
)
async def get_recommendation_result(
    recommendation_session_id: int,
    member_id: int = Depends(get_current_member_id),
) -> RecommendationResult:
    """추천 결과 조회(폴링). generation_status가 processing이면 잠시 뒤 다시 조회한다.

    지금은 응답 형식만 공개했고 호출하면 501을 돌려준다.
    실제 조회는 결과 저장(REC-16) 이후 구현한다.
    """
    raise ResultNotImplementedError()
