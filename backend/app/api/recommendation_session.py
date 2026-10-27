from datetime import datetime

from fastapi import APIRouter, BackgroundTasks, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_member_id, get_now
from app.core.db import get_db
from app.schemas.recommendation_result import RecommendationResult
from app.schemas.recommendation_session import (
    CancelResult,
    RatingCreate,
    RatingResult,
    RecommendationSessionCreate,
    RecommendationSessionCreated,
)
from app.schemas.regeneration_request import RegenerationCreate, RegenerationCreated
from app.services import rating_settlement as settlement_service
from app.services import recommendation_result as result_service
from app.services import recommendation_session as session_service
from app.services import regeneration_request as regeneration_service
from app.services import session_end as session_end_service
from app.services.llm import LLMClient, get_llm_client
from app.services.recommendation_pipeline import run_recommendation_pipeline
from app.services.regeneration_pipeline import run_regeneration_pipeline
from app.services.storage import ImageStorage, get_image_storage

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


@router.get(
    "/{recommendation_session_id}",
    response_model=RecommendationResult,
    responses={404: {"description": "없는 세션이거나 본인 세션이 아님"}},
)
async def get_recommendation_result(
    recommendation_session_id: int,
    db: AsyncSession = Depends(get_db),
    member_id: int = Depends(get_current_member_id),
    storage: ImageStorage = Depends(get_image_storage),
) -> RecommendationResult:
    """추천 결과 조회(폴링). generation_status_cd가 processing이면 잠시 뒤 다시 조회한다."""
    return await result_service.get_recommendation_result(
        db, storage, recommendation_session_id, member_id
    )


@router.post(
    "/{recommendation_session_id}/rating",
    response_model=RatingResult,
    responses={
        404: {"description": "없는 세션이거나 본인 세션이 아님, 또는 이 세션의 코디가 아님"},
        409: {"description": "이미 정산된 세션이거나 별점을 매길 수 없는 상태"},
    },
)
async def rate_recommendation(
    recommendation_session_id: int,
    body: RatingCreate,
    db: AsyncSession = Depends(get_db),
    member_id: int = Depends(get_current_member_id),
    now: datetime = Depends(get_now),
) -> RatingResult:
    """코디 하나에 별점을 매기고 세션을 종료한다. 세션의 모든 코디가 함께 정산된다."""
    await settlement_service.rate_and_settle(
        db, recommendation_session_id, member_id, body.outfit_id, body.rating, now
    )
    return RatingResult(
        recommendation_session_id=recommendation_session_id,
        outfit_id=body.outfit_id,
        rating=body.rating,
        session_status_cd="completed",
    )


@router.post(
    "/{recommendation_session_id}/cancel",
    response_model=CancelResult,
    responses={
        404: {"description": "없는 세션이거나 본인 세션이 아님"},
        409: {"description": "이미 별점을 매겨 끝난 세션"},
    },
)
async def cancel_recommendation_session(
    recommendation_session_id: int,
    db: AsyncSession = Depends(get_db),
    member_id: int = Depends(get_current_member_id),
    now: datetime = Depends(get_now),
) -> CancelResult:
    """조건 입력 화면으로 돌아갈 때 세션을 취소한다. 점수는 반영하지 않고 추천 결과는 지운다.

    생성 중에도 취소할 수 있다. 이미 취소·이탈된 세션이면 상태만 그대로 돌려준다.
    """
    session_status_cd = await session_end_service.cancel_session(
        db, recommendation_session_id, member_id, now
    )
    return CancelResult(
        recommendation_session_id=recommendation_session_id, session_status_cd=session_status_cd
    )


@router.post(
    "/{recommendation_session_id}/regenerations",
    status_code=status.HTTP_202_ACCEPTED,
    response_model=RegenerationCreated,
    responses={
        404: {"description": "없는 세션이거나 본인 세션이 아님, 또는 이 세션의 코디가 아님"},
        409: {
            "description": (
                "첫 추천이 끝나지 않았거나 실패한 세션, 별점·취소·이탈로 끝난 세션, "
                "또는 재추천을 만드는 중"
            )
        },
        422: {
            "description": (
                "요청이 너무 김, 유해 입력, 이해하지 못한 요청, "
                "지금 화면에 없는 코디를 대상으로 지정, 또는 대상 범위가 맞지 않음"
            )
        },
        503: {"description": "요청 의도를 일시적으로 파악하지 못함. 다시 시도할 수 있음"},
    },
)
async def request_regeneration(
    recommendation_session_id: int,
    body: RegenerationCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    member_id: int = Depends(get_current_member_id),
    now: datetime = Depends(get_now),
    llm: LLMClient = Depends(get_llm_client),
) -> RegenerationCreated:
    """재추천 요청. 요청을 검증하고 의도를 파악해 기록한 뒤 202를 돌려준다.

    코디 생성은 백그라운드에서 한다.
    """
    accepted = await regeneration_service.request_regeneration(
        db, llm, recommendation_session_id, member_id, body, now
    )
    background_tasks.add_task(run_regeneration_pipeline, accepted.regeneration_request_id, llm)
    return RegenerationCreated(
        recommendation_session_id=recommendation_session_id,
        regeneration_request_id=accepted.regeneration_request_id,
        request_seq=accepted.request_seq,
        regeneration_status_cd="processing",
    )
