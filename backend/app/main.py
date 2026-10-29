from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api import (
    auth,
    clothing,
    health,
    media,
    member,
    recommendation_history,
    recommendation_precheck,
    recommendation_session,
    regions,
    weather,
)
from app.core.config import get_settings
from app.core.errors import register_exception_handlers
from app.core.logging import RequestIdMiddleware, setup_logging
from app.schemas.error import ErrorResponse
from app.services.input_guard import load_input_guard
from app.services.llm import llm_lifespan
from app.workers.auto_tagging_lifespan import auto_tagging_lifespan
from app.workers.bg_removal_lifespan import bg_removal_lifespan

setup_logging()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    load_input_guard()
    async with llm_lifespan(app), auto_tagging_lifespan(app), bg_removal_lifespan(app):
        yield


app = FastAPI(
    title="Outfit Recommendation API",
    version="0.1.0",
    lifespan=lifespan,
    responses={422: {"model": ErrorResponse, "description": "입력값 검증 실패"}},
)

AUTH_REQUIRED_RESPONSES = {401: {"model": ErrorResponse, "description": "로그인 필요"}}

app.add_middleware(RequestIdMiddleware)
register_exception_handlers(app)

app.include_router(health.router)
app.include_router(recommendation_precheck.router, responses=AUTH_REQUIRED_RESPONSES)
app.include_router(recommendation_session.router, responses=AUTH_REQUIRED_RESPONSES)
app.include_router(recommendation_history.router, responses=AUTH_REQUIRED_RESPONSES)
app.include_router(weather.router)
app.include_router(regions.router)
app.include_router(clothing.router, responses=AUTH_REQUIRED_RESPONSES)
app.include_router(auth.router)
app.include_router(media.router)
app.include_router(member.router, responses=AUTH_REQUIRED_RESPONSES)

settings = get_settings()
settings.MEDIA_ROOT.mkdir(parents=True, exist_ok=True)
