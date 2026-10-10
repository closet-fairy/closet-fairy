"""배경 제거 모델과 워커를 앱 수명에 묶는다 (#72, #77).

main.py의 lifespan에서 `async with bg_removal_lifespan(app):`로 감싸 쓴다.
"""

import asyncio
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.core.config import get_settings
from app.core.db import AsyncSessionLocal
from app.services.bg_removal import BackgroundRemover
from app.services.storage import get_image_storage
from app.workers.bg_removal_worker import BgRemovalWorker


@asynccontextmanager
async def bg_removal_lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    if not settings.BG_REMOVAL_ENABLED:
        yield
        return

    # 모델 로드(최초 1회는 다운로드)와 워밍업이 수 초 걸리는 동기 작업이라 스레드에서 돌린다
    remover = await asyncio.to_thread(
        BackgroundRemover, settings.BG_REMOVAL_MODEL, settings.BG_REMOVAL_POST_PROCESS_MASK
    )
    await asyncio.to_thread(remover.warmup)
    worker = BgRemovalWorker(
        remover,
        get_image_storage(),
        AsyncSessionLocal,
        concurrency=settings.BG_REMOVAL_CONCURRENCY,
        poll_interval_s=settings.BG_REMOVAL_POLL_INTERVAL_S,
    )
    await worker.start()
    app.state.bg_removal_worker = worker
    try:
        yield
    finally:
        await worker.stop()
        del app.state.bg_removal_worker
