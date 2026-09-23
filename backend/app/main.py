from fastapi import FastAPI

from app.api import health
from app.core.errors import register_exception_handlers
from app.core.logging import RequestIdMiddleware, setup_logging

setup_logging()

app = FastAPI(title="Outfit Recommendation API", version="0.1.0")

app.add_middleware(RequestIdMiddleware)
register_exception_handlers(app)

app.include_router(health.router)
