"""배경 제거 워커 (#72).

추론은 전용 스레드 풀에서 돌려 이벤트 루프(다른 API 응답)를 막지 않는다.
누끼를 저장하면 같은 트랜잭션에서 자동 태깅 작업을 등록한다(FR-REG-11, #73).
"""

import asyncio
import logging
import posixpath
import time
from concurrent.futures import ThreadPoolExecutor
from typing import Protocol

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.core.logging import Event
from app.repositories import clothing_job as job_repo
from app.repositories.clothing_job import STAGE_AUTO_TAGGING, STAGE_BG_REMOVAL, ClaimedJob
from app.services.clothing_upload import JobNotifier
from app.services.storage import ImageStorage
from app.workers.clothing_job_worker import ClothingJobWorker

logger = logging.getLogger(__name__)

# 응답으로 그대로 나가는 값이라 예외 메시지 대신 고정 문구를 남긴다. 원인은 로그로 본다
FAILURE_REASON = "배경 제거에 실패했습니다."


class Remover(Protocol):
    def remove(self, image: bytes) -> bytes: ...


def cutout_key_for(origin_key: str) -> str:
    """원본 키 옆에 결과를 둔다. clothing/1/abc.webp → clothing/1/abc_cutout.webp"""
    stem, _ = posixpath.splitext(origin_key)
    return f"{stem}_cutout.webp"


class BgRemovalWorker(ClothingJobWorker):
    stage_cd = STAGE_BG_REMOVAL
    label = "배경 제거"
    recovered_event = Event.BG_REMOVAL_RECOVERED

    def __init__(
        self,
        remover: Remover,
        storage: ImageStorage,
        session_factory: async_sessionmaker[AsyncSession],
        concurrency: int = 1,
        poll_interval_s: float = 2.0,
        tagging_worker: JobNotifier | None = None,
    ) -> None:
        super().__init__(session_factory, concurrency, poll_interval_s)
        self._remover = remover
        self._storage = storage
        self._tagging_worker = tagging_worker
        self._executor = ThreadPoolExecutor(
            max_workers=concurrency, thread_name_prefix="bg-removal"
        )

    async def stop(self) -> None:
        await super().stop()
        self._executor.shutdown(wait=False, cancel_futures=True)

    async def _process(self, job: ClaimedJob) -> None:
        started = time.perf_counter()
        cutout_key: str | None = None
        try:
            cutout_key = await self._remove_and_save(job)
            is_completed = await self._record_result(job, cutout_key)
        except Exception:
            logger.exception(
                "배경 제거 실패",
                extra={"event": Event.BG_REMOVAL_FAIL, "clothing_id": job.clothing_id},
            )
            await self._mark_failed(job)
            if cutout_key is not None:
                await self._storage.delete(cutout_key)
            return

        if not is_completed:
            await self._storage.delete(cutout_key)
            return
        if self._tagging_worker is not None:
            self._tagging_worker.notify()
        logger.info(
            "배경 제거 완료",
            extra={
                "event": Event.BG_REMOVAL_DONE,
                "clothing_id": job.clothing_id,
                "elapsed_ms": round((time.perf_counter() - started) * 1000),
            },
        )

    async def _remove_and_save(self, job: ClaimedJob) -> str:
        origin = await self._storage.read(job.origin_image_url)
        loop = asyncio.get_running_loop()
        cutout = await loop.run_in_executor(self._executor, self._remover.remove, origin)
        cutout_key = cutout_key_for(job.origin_image_url)
        await self._storage.save(cutout_key, cutout)
        return cutout_key

    async def _record_result(self, job: ClaimedJob, cutout_key: str) -> bool:
        """결과를 기록한다. 그사이 취소된 job이면 기록하지 않고 False를 돌려준다."""
        async with self._session_factory() as db:
            if await job_repo.lock_is_canceled(db, job.clothing_job_id):
                await job_repo.finish_job(db, job.clothing_job_id)
                await db.commit()
                return False
            await job_repo.save_cutout(db, job.clothing_id, cutout_key)
            await job_repo.finish_job(db, job.clothing_job_id)
            await job_repo.enqueue_job(db, job.clothing_id, STAGE_AUTO_TAGGING)
            await db.commit()
        return True

    async def _mark_failed(self, job: ClaimedJob) -> None:
        try:
            async with self._session_factory() as db:
                await job_repo.finish_job(db, job.clothing_job_id, FAILURE_REASON)
                await job_repo.fail_clothing(db, job.clothing_id)
                await db.commit()
        except Exception:
            # DB에 실패조차 기록하지 못하면 job은 처리 중으로 남는다.
            # 서버를 재시작할 때 requeue_interrupted가 대기열로 되돌린다
            logger.exception(
                "배경 제거 실패를 기록하지 못함", extra={"clothing_id": job.clothing_id}
            )
