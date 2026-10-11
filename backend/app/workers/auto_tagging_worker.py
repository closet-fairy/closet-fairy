"""자동 태깅 워커 (#73).

배경 제거와 달리 태깅은 실패로 끝나지 않는다(FR-REG-20). 모델 오류·시간 초과·인식 실패면
속성을 비운 채 완료하고, 회원이 의류 수정에서 채운다(FR-REG-21).
"""

import asyncio
import logging
import time
from typing import Protocol

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.logging import Event
from app.repositories import clothing_job as job_repo
from app.repositories.clothing_job import STAGE_AUTO_TAGGING, ClaimedJob, ClothingTags
from app.services.storage import ImageStorage
from app.workers.clothing_job_worker import ClothingJobWorker

logger = logging.getLogger(__name__)


class Tagger(Protocol):
    async def tag(self, cutout: bytes) -> ClothingTags: ...


class AutoTaggingWorker(ClothingJobWorker):
    stage_cd = STAGE_AUTO_TAGGING
    label = "자동 태깅"
    recovered_event = Event.AUTO_TAGGING_RECOVERED

    def __init__(
        self,
        tagger: Tagger,
        storage: ImageStorage,
        session_factory: async_sessionmaker[AsyncSession],
        concurrency: int = 2,
        poll_interval_s: float = 2.0,
        timeout_s: float = 60.0,
    ) -> None:
        super().__init__(session_factory, concurrency, poll_interval_s)
        self._tagger = tagger
        self._storage = storage
        self._timeout_s = timeout_s

    async def _process(self, job: ClaimedJob) -> None:
        started = time.perf_counter()
        tags = await self._tag(job)
        try:
            is_completed = await self._record_result(job, tags)
        except Exception:
            logger.exception(
                "자동 태깅 결과를 기록하지 못함", extra={"clothing_id": job.clothing_id}
            )
            return
        if not is_completed:
            return
        logger.info(
            "자동 태깅 완료",
            extra={
                "event": Event.AUTO_TAGGING_DONE,
                "clothing_id": job.clothing_id,
                "is_empty": tags.is_empty,
                "elapsed_ms": round((time.perf_counter() - started) * 1000),
            },
        )

    async def _tag(self, job: ClaimedJob) -> ClothingTags:
        try:
            if job.cutout_image_url is None:
                raise ValueError("누끼 이미지가 없습니다.")
            cutout = await self._storage.read(job.cutout_image_url)
            return await asyncio.wait_for(self._tagger.tag(cutout), timeout=self._timeout_s)
        except Exception as e:
            logger.warning(
                "자동 태깅 실패, 빈 값으로 완료",
                exc_info=True,
                extra={
                    "event": Event.AUTO_TAGGING_FALLBACK,
                    "clothing_id": job.clothing_id,
                    "error_type": type(e).__name__,
                },
            )
            return ClothingTags()

    async def _record_result(self, job: ClaimedJob, tags: ClothingTags) -> bool:
        """결과를 기록한다. 그사이 취소된 job이면 기록하지 않고 False를 돌려준다(FR-REG-19)."""
        async with self._session_factory() as db:
            if await job_repo.lock_is_canceled(db, job.clothing_job_id):
                await job_repo.finish_job(db, job.clothing_job_id)
                await db.commit()
                return False
            await job_repo.complete_with_tags(db, job.clothing_id, tags)
            await job_repo.finish_job(db, job.clothing_job_id)
            await db.commit()
        return True
