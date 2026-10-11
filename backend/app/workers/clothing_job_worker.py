"""clothing_job 큐 워커의 공통 루프 (#72, #73).

앱 lifespan과 함께 뜨는 asyncio 태스크다. clothing_job을 큐로 삼아 단계(stage_cd)별로
하나씩 꺼내 처리하므로 서버가 재시작돼도 작업이 사라지지 않는다(NFR-REG-09).
BackgroundTasks는 재시작하면 사라져서 쓰지 않는다.
"""

import asyncio
import logging

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.repositories import clothing_job as job_repo
from app.repositories.clothing_job import ClaimedJob

logger = logging.getLogger(__name__)


class ClothingJobWorker:
    stage_cd: str
    label: str
    recovered_event: str

    def __init__(
        self,
        session_factory: async_sessionmaker[AsyncSession],
        concurrency: int = 1,
        poll_interval_s: float = 2.0,
    ) -> None:
        self._session_factory = session_factory
        self._concurrency = concurrency
        self._poll_interval_s = poll_interval_s
        self._wakeup = asyncio.Event()
        self._tasks: list[asyncio.Task[None]] = []

    async def start(self) -> None:
        async with self._session_factory() as db:
            requeued = await job_repo.requeue_interrupted(db, self.stage_cd)
            await db.commit()
        if requeued:
            logger.info(
                f"중단된 {self.label} 작업을 다시 대기열에 넣음",
                extra={"event": self.recovered_event, "count": requeued},
            )
        self._tasks = [
            asyncio.create_task(self._run(), name=f"{self.stage_cd}-{i}")
            for i in range(self._concurrency)
        ]

    async def stop(self) -> None:
        for task in self._tasks:
            task.cancel()
        await asyncio.gather(*self._tasks, return_exceptions=True)

    def notify(self) -> None:
        """새 작업이 들어왔음을 알린다. 없어도 poll_interval_s마다 큐를 확인한다."""
        self._wakeup.set()

    async def _run(self) -> None:
        while True:
            try:
                handled = await self.run_once()
            except Exception:
                logger.exception(f"{self.label} 워커 루프 오류")
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
            job = await job_repo.claim_next(db, self.stage_cd)
            await db.commit()
        if job is None:
            return False
        await self._process(job)
        return True

    async def _process(self, job: ClaimedJob) -> None:
        raise NotImplementedError
