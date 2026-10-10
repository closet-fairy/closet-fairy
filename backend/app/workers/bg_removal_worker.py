"""배경 제거 워커 (#72).

앱 lifespan과 함께 뜨는 asyncio 태스크다. clothing_job을 큐로 삼아 하나씩 꺼내 처리하므로
서버가 재시작돼도 작업이 사라지지 않는다(NFR-REG-09).
BackgroundTasks는 재시작하면 사라져서 쓰지 않는다.
추론은 전용 스레드 풀에서 돌려 이벤트 루프(다른 API 응답)를 막지 않는다.
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
from app.repositories.clothing_job import STAGE_BG_REMOVAL, ClaimedJob
from app.services.storage import ImageStorage

logger = logging.getLogger(__name__)

# 응답으로 그대로 나가는 값이라 예외 메시지 대신 고정 문구를 남긴다. 원인은 로그로 본다
FAILURE_REASON = "배경 제거에 실패했습니다."


class Remover(Protocol):
    def remove(self, image: bytes) -> bytes: ...


def cutout_key_for(origin_key: str) -> str:
    """원본 키 옆에 결과를 둔다. clothing/1/abc.webp → clothing/1/abc_cutout.png"""
    stem, _ = posixpath.splitext(origin_key)
    return f"{stem}_cutout.png"


class BgRemovalWorker:
    def __init__(
        self,
        remover: Remover,
        storage: ImageStorage,
        session_factory: async_sessionmaker[AsyncSession],
        concurrency: int = 1,
        poll_interval_s: float = 2.0,
    ) -> None:
        self._remover = remover
        self._storage = storage
        self._session_factory = session_factory
        self._concurrency = concurrency
        self._poll_interval_s = poll_interval_s
        self._wakeup = asyncio.Event()
        self._executor = ThreadPoolExecutor(
            max_workers=concurrency, thread_name_prefix="bg-removal"
        )
        self._tasks: list[asyncio.Task[None]] = []

    async def start(self) -> None:
        async with self._session_factory() as db:
            requeued = await job_repo.requeue_interrupted(db, STAGE_BG_REMOVAL)
            await db.commit()
        if requeued:
            logger.info(
                "중단된 배경 제거 작업을 다시 대기열에 넣음",
                extra={"event": Event.BG_REMOVAL_RECOVERED, "count": requeued},
            )
        self._tasks = [
            asyncio.create_task(self._run(), name=f"bg-removal-{i}")
            for i in range(self._concurrency)
        ]

    async def stop(self) -> None:
        for task in self._tasks:
            task.cancel()
        await asyncio.gather(*self._tasks, return_exceptions=True)
        self._executor.shutdown(wait=False, cancel_futures=True)

    def notify(self) -> None:
        """새 작업이 들어왔음을 알린다. 없어도 poll_interval_s마다 큐를 확인한다."""
        self._wakeup.set()

    async def _run(self) -> None:
        while True:
            try:
                handled = await self.run_once()
            except Exception:
                logger.exception("배경 제거 워커 루프 오류")
                handled = False
            if not handled:
                await self._wait_for_work()

    async def _wait_for_work(self) -> None:
        try:
            await asyncio.wait_for(self._wakeup.wait(), timeout=self._poll_interval_s)
        except TimeoutError:
            pass
        self._wakeup.clear()

    async def run_once(self) -> bool:
        """대기 중인 작업을 하나 처리한다. 처리할 작업이 없으면 False."""
        async with self._session_factory() as db:
            job = await job_repo.claim_next(db, STAGE_BG_REMOVAL)
            await db.commit()
        if job is None:
            return False
        await self._process(job)
        return True

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
            await job_repo.complete_clothing(db, job.clothing_id, cutout_key)
            await job_repo.finish_job(db, job.clothing_job_id)
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
                "배경 제거 실패를 기록하지 못함",
                extra={"event": Event.BG_REMOVAL_FAIL, "clothing_id": job.clothing_id},
            )
