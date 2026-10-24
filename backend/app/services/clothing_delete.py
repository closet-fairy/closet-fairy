"""옷 삭제 (#76, FR-DEL).

처리 중이거나 실패한 옷도 지운다. 옷을 지우면 처리 작업 행도 함께 사라지고(ON DELETE CASCADE),
워커는 작업 행이 없으면 취소된 것으로 보고 결과를 버린다(FR-DEL-05).
별점을 받은 코디에 쓰인 이미지는 추천 내역을 그대로 보여주려고 남긴다(E-8).
"""

import logging

from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories import clothing as clothing_repo
from app.services.clothing_query import ClothingNotFoundError
from app.services.storage import ImageStorage

logger = logging.getLogger(__name__)


async def delete_clothing(
    db: AsyncSession, storage: ImageStorage, member_id: int, clothing_id: int
) -> None:
    async with db.begin():
        await clothing_repo.lock_clothing_jobs(db, member_id, clothing_id)
        clothing = await clothing_repo.get_clothing_for_edit(db, member_id, clothing_id, lock=True)
        if clothing is None:
            raise ClothingNotFoundError()
        edit = await clothing_repo.get_clothing_edit(db, clothing_id)
        keys = {clothing.origin_image_url, clothing.cutout_image_url}
        if edit is not None:
            keys.update((edit.brush_mask_url, edit.display_image_url))
        keys.discard(None)
        keys -= await clothing_repo.get_rated_snapshot_keys(db, clothing_id)
        await clothing_repo.delete_clothing(db, clothing_id)

    for key in sorted(keys):
        try:
            await storage.delete(key)
        except Exception:
            logger.warning("옷 삭제 후 이미지 정리 실패", exc_info=True, extra={"key": key})
