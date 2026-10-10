from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.api import clothing, health, recommendation_precheck, recommendation_session, weather
from app.core.config import get_settings
from app.core.errors import register_exception_handlers
from app.core.logging import RequestIdMiddleware, setup_logging
from app.schemas.error import ErrorResponse
from app.services.llm import llm_lifespan

setup_logging()

app = FastAPI(
    title="Outfit Recommendation API",
    version="0.1.0",
    lifespan=llm_lifespan,
    responses={422: {"model": ErrorResponse, "description": "입력값 검증 실패"}},
)

app.add_middleware(RequestIdMiddleware)
register_exception_handlers(app)

app.include_router(health.router)
app.include_router(recommendation_precheck.router)
app.include_router(recommendation_session.router)
app.include_router(weather.router)
app.include_router(clothing.router)

settings = get_settings()
settings.MEDIA_ROOT.mkdir(parents=True, exist_ok=True)
app.mount(settings.MEDIA_URL_PREFIX, StaticFiles(directory=settings.MEDIA_ROOT), name="media")
