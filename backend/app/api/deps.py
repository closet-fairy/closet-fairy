"""라우터 공통 의존성. 테스트에서 app.dependency_overrides로 바꿔 끼울 수 있다."""

from datetime import datetime

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.services.auth import session as session_service
from app.services.clothing_rate_limit import RequestRateLimiter, get_clothing_rate_limiter
from app.services.weather.base_time import KST
from app.workers.bg_removal_worker import BgRemovalWorker


async def get_current_member_id(request: Request, db: AsyncSession = Depends(get_db)) -> int:
    return await session_service.authenticate(
        db, request.cookies.get(session_service.SESSION_COOKIE)
    )


def get_now() -> datetime:
    """현재 시각(KST). 테스트에서 시각을 고정하려고 함수로 뺐다."""
    return datetime.now(KST)


def get_bg_removal_worker(request: Request) -> BgRemovalWorker | None:
    """배경 제거를 끈 환경(테스트 등)에서는 워커가 없어 None이다."""
    return getattr(request.app.state, "bg_removal_worker", None)


async def limit_clothing_requests(
    member_id: int = Depends(get_current_member_id),
    limiter: RequestRateLimiter = Depends(get_clothing_rate_limiter),
) -> None:
    """옷 등록·재시도 요청 빈도를 회원별로 제한한다. 넘으면 429."""
    limiter.check(member_id)
