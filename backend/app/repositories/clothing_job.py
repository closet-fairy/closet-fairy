"""비동기 처리 작업 큐 (#72). commit은 호출자가 한다.

clothing_job 테이블을 큐로 쓴다. started_at IS NULL이면 대기 중이다(FR-REG-10).
"""

from dataclasses import dataclass

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

STAGE_BG_REMOVAL = "bg_removal"


@dataclass(frozen=True)
class ClaimedJob:
    clothing_job_id: int
    clothing_id: int
    origin_image_url: str


# 서버가 처리 도중 죽으면 started_at만 찍히고 finished_at은 비어 남는다.
# 인스턴스가 하나라는 전제에서, 기동 시점에 이런 job은 모두 중단된 것이다
REQUEUE_INTERRUPTED_SQL = text(
    """
    UPDATE clothing_job
    SET started_at = NULL
    WHERE stage_cd = :stage_cd AND started_at IS NOT NULL AND finished_at IS NULL
    """
)

# SKIP LOCKED로 다른 워커가 잡고 있는 행을 건너뛰어, 같은 job을 두 번 처리하지 않는다
SELECT_NEXT_JOB_SQL = text(
    """
    SELECT j.clothing_job_id, j.clothing_id, c.origin_image_url
    FROM clothing_job j
    JOIN clothing c ON c.clothing_id = j.clothing_id
    WHERE j.stage_cd = :stage_cd AND j.started_at IS NULL AND j.is_canceled = FALSE
    ORDER BY j.created_at, j.clothing_job_id
    LIMIT 1
    FOR UPDATE OF j SKIP LOCKED
    """
)

MARK_STARTED_SQL = text(
    """
    UPDATE clothing_job SET started_at = UTC_TIMESTAMP()
    WHERE clothing_job_id = :clothing_job_id
    """
)

SELECT_IS_CANCELED_FOR_UPDATE_SQL = text(
    """
    SELECT is_canceled FROM clothing_job WHERE clothing_job_id = :clothing_job_id FOR UPDATE
    """
)

FINISH_JOB_SQL = text(
    """
    UPDATE clothing_job
    SET finished_at = UTC_TIMESTAMP(), failure_reason = :failure_reason
    WHERE clothing_job_id = :clothing_job_id
    """
)

COMPLETE_CLOTHING_SQL = text(
    """
    UPDATE clothing
    SET cutout_image_url = :cutout_image_url, processing_status_cd = 'completed'
    WHERE clothing_id = :clothing_id
    """
)

FAIL_CLOTHING_SQL = text(
    """
    UPDATE clothing SET processing_status_cd = 'failed' WHERE clothing_id = :clothing_id
    """
)


async def requeue_interrupted(db: AsyncSession, stage_cd: str) -> int:
    result = await db.execute(REQUEUE_INTERRUPTED_SQL, {"stage_cd": stage_cd})
    return int(result.rowcount)


async def claim_next(db: AsyncSession, stage_cd: str) -> ClaimedJob | None:
    result = await db.execute(SELECT_NEXT_JOB_SQL, {"stage_cd": stage_cd})
    row = result.first()
    if row is None:
        return None
    await db.execute(MARK_STARTED_SQL, {"clothing_job_id": row.clothing_job_id})
    return ClaimedJob(
        clothing_job_id=row.clothing_job_id,
        clothing_id=row.clothing_id,
        origin_image_url=row.origin_image_url,
    )


async def lock_is_canceled(db: AsyncSession, clothing_job_id: int) -> bool:
    """job 행을 잠그고 취소 여부를 본다. 잠금은 호출자가 commit할 때 풀린다.

    잠근 채로 결과를 기록해야, 확인과 기록 사이에 삭제(FR-DEL-05)가 끼어들지 못한다.
    옷이 삭제되어 job 행이 사라진 경우도 취소로 본다 (ON DELETE CASCADE).
    """
    result = await db.execute(
        SELECT_IS_CANCELED_FOR_UPDATE_SQL, {"clothing_job_id": clothing_job_id}
    )
    value = result.scalar_one_or_none()
    return value is None or bool(value)


async def finish_job(
    db: AsyncSession, clothing_job_id: int, failure_reason: str | None = None
) -> None:
    await db.execute(
        FINISH_JOB_SQL, {"clothing_job_id": clothing_job_id, "failure_reason": failure_reason}
    )


async def complete_clothing(db: AsyncSession, clothing_id: int, cutout_image_url: str) -> None:
    await db.execute(
        COMPLETE_CLOTHING_SQL,
        {"clothing_id": clothing_id, "cutout_image_url": cutout_image_url},
    )


async def fail_clothing(db: AsyncSession, clothing_id: int) -> None:
    await db.execute(FAIL_CLOTHING_SQL, {"clothing_id": clothing_id})
