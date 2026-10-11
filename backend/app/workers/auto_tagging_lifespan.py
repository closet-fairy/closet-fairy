"""자동 태깅 워커를 앱 수명에 묶는다 (#73).

LLM 클라이언트를 쓰므로 main.py에서 llm_lifespan 안쪽, bg_removal_lifespan 바깥쪽에 둔다.
"""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.core.config import get_settings
from app.core.db import AsyncSessionLocal
from app.services.clothing_tagging import ClothingTagger
from app.services.storage import get_image_storage
from app.workers.auto_tagging_worker import AutoTaggingWorker


@asynccontextmanager
async def auto_tagging_lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    if not settings.AUTO_TAGGING_ENABLED:
        yield
        return

    tagger = ClothingTagger(
        app.state.llm_client, settings.AUTO_TAGGING_MODEL, settings.AUTO_TAGGING_IMAGE_MAX_SIDE
    )
    worker = AutoTaggingWorker(
        tagger,
        get_image_storage(),
        AsyncSessionLocal,
        concurrency=settings.AUTO_TAGGING_CONCURRENCY,
        poll_interval_s=settings.AUTO_TAGGING_POLL_INTERVAL_S,
        timeout_s=settings.AUTO_TAGGING_TIMEOUT_S,
    )
    await worker.start()
    app.state.auto_tagging_worker = worker
    try:
        yield
    finally:
        await worker.stop()
        del app.state.auto_tagging_worker
