from fastapi import APIRouter, Depends, File, Query, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_member_id
from app.core.db import get_db
from app.schemas.clothing import (
    ClothingDetail,
    ClothingPage,
    ClothingStatusList,
    ClothingUploadResult,
)
from app.services import clothing_query as query_service
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


@router.get("", response_model=ClothingPage)
async def list_clothing(
    cursor: int | None = Query(default=None, ge=1, description="이전 응답의 next_cursor"),
    limit: int = Query(default=20, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    member_id: int = Depends(get_current_member_id),
    storage: ImageStorage = Depends(get_image_storage),
) -> ClothingPage:
    """내 옷장 목록. 최근 등록한 옷부터 limit벌씩 나눠 준다 (무한 스크롤)."""
    return await query_service.get_clothing_page(db, storage, member_id, cursor, limit)


@router.get("/status", response_model=ClothingStatusList)
async def get_clothing_status(
    ids: str = Query(
        pattern=r"^[1-9][0-9]*(,[1-9][0-9]*)*$",
        description="처리 중인 옷 id를 쉼표로 이어 보낸다. 최대 50개",
        examples=["31,32,33"],
    ),
    db: AsyncSession = Depends(get_db),
    member_id: int = Depends(get_current_member_id),
    storage: ImageStorage = Depends(get_image_storage),
) -> ClothingStatusList:
    """처리 상태 폴링. 처리 중인 옷만 모아 1초 간격으로 부르고, 모두 끝나면 멈춘다."""
    clothing_ids = [int(value) for value in ids.split(",")]
    return await query_service.get_clothing_status(db, storage, member_id, clothing_ids)


@router.get(
    "/{clothing_id}",
    response_model=ClothingDetail,
    responses={404: {"description": "없는 옷이거나 본인 옷이 아님"}},
)
async def get_clothing(
    clothing_id: int,
    db: AsyncSession = Depends(get_db),
    member_id: int = Depends(get_current_member_id),
    storage: ImageStorage = Depends(get_image_storage),
) -> ClothingDetail:
    """옷 상세. 속성·스타일·계절·편집값과 처리 상태를 함께 준다."""
    return await query_service.get_clothing_detail(db, storage, member_id, clothing_id)
