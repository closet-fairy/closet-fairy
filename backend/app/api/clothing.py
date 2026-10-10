from fastapi import APIRouter, Depends, File, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_member_id
from app.core.db import get_db
from app.schemas.clothing import ClothingUploadResult
from app.services import clothing_upload as upload_service
from app.services.storage import ImageStorage, get_image_storage

router = APIRouter(prefix="/clothing", tags=["clothing"])


@router.post("", status_code=status.HTTP_202_ACCEPTED, response_model=ClothingUploadResult)
async def upload_clothing(
    files: list[UploadFile] = File(description="옷 사진. 사진 1장 = 옷 1벌"),
    db: AsyncSession = Depends(get_db),
    member_id: int = Depends(get_current_member_id),
    storage: ImageStorage = Depends(get_image_storage),
) -> ClothingUploadResult:
    """옷 사진 업로드 (FR-REG). 배경 제거·태깅은 기다리지 않고 바로 응답한다.

    형식·용량이 맞지 않는 사진은 제외하고 rejected에 사유를 담는다. 모두 제외돼도 202다.
    """
    return await upload_service.upload_clothing(db, storage, member_id, files)
