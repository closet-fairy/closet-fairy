"""처리에 실패한 옷 다시 처리하기 (#76, FR-REG-24).

배경 제거부터 다시 한다. 작업 행은 새로 만든다(재시도마다 신규 발급).
화면은 업로드 직후처럼 옷 id로 상태를 폴링하면 된다.
"""

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ConflictError
from app.repositories import clothing as clothing_repo
from app.schemas.clothing import ClothingProgress
from app.services.clothing_query import ClothingNotFoundError, get_clothing_status
from app.services.clothing_upload import JobNotifier
from app.services.storage import ImageStorage


class ClothingNotRetryableError(ConflictError):
    code = "CLOTHING_NOT_RETRYABLE"
    message = "처리에 실패한 옷만 다시 처리할 수 있습니다."


async def retry_clothing(
    db: AsyncSession,
    storage: ImageStorage,
    member_id: int,
    clothing_id: int,
    worker: JobNotifier | None = None,
) -> ClothingProgress:
    async with db.begin():
        await clothing_repo.lock_clothing_jobs(db, member_id, clothing_id)
        clothing = await clothing_repo.get_clothing_for_edit(db, member_id, clothing_id, lock=True)
        if clothing is None:
            raise ClothingNotFoundError()
        if clothing.processing_status_cd != "failed":
            raise ClothingNotRetryableError()
        await clothing_repo.reset_for_retry(db, clothing_id)
    if worker is not None:
        worker.notify()
    status = await get_clothing_status(db, storage, member_id, [clothing_id])
    if not status.items:
        raise ClothingNotFoundError()
    return status.items[0]
