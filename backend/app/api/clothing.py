from fastapi import APIRouter, Depends, File, Query, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_bg_removal_worker, get_current_member_id
from app.core.db import get_db
from app.schemas.clothing import (
    ClothingDetail,
    ClothingEditUpdate,
    ClothingPage,
    ClothingStatusList,
    ClothingUpdate,
    ClothingUploadResult,
)
from app.services import clothing_edit as edit_service
from app.services import clothing_query as query_service
from app.services import clothing_upload as upload_service
from app.services.storage import ImageStorage, get_image_storage
from app.workers.bg_removal_worker import BgRemovalWorker

router = APIRouter(prefix="/clothing", tags=["clothing"])


@router.post("", status_code=status.HTTP_202_ACCEPTED, response_model=ClothingUploadResult)
async def upload_clothing(
    files: list[UploadFile] = File(description="옷 사진. 사진 1장 = 옷 1벌"),
    db: AsyncSession = Depends(get_db),
    member_id: int = Depends(get_current_member_id),
    storage: ImageStorage = Depends(get_image_storage),
    worker: BgRemovalWorker | None = Depends(get_bg_removal_worker),
) -> ClothingUploadResult:
    """옷 사진 업로드 (FR-REG). 배경 제거·태깅은 기다리지 않고 바로 응답한다.

    형식·용량이 맞지 않는 사진은 제외하고 rejected에 사유를 담는다. 모두 제외돼도 202다.
    """
    return await upload_service.upload_clothing(db, storage, member_id, files, worker)


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


_EDIT_RESPONSES = {
    404: {"description": "없는 옷이거나 본인 옷이 아님"},
    409: {"description": "처리 중이거나 실패한 옷 (CLOTHING_NOT_EDITABLE)"},
}


@router.patch("/{clothing_id}", response_model=ClothingDetail, responses=_EDIT_RESPONSES)
async def update_clothing(
    clothing_id: int,
    update: ClothingUpdate,
    db: AsyncSession = Depends(get_db),
    member_id: int = Depends(get_current_member_id),
    storage: ImageStorage = Depends(get_image_storage),
) -> ClothingDetail:
    """속성 수정 (FR-EDIT-07~09). 보낸 필드만 바뀌고 null은 값을 비운다. 신규 표시도 끈다.

    분류를 악세서리가 아닌 값으로 바꾸면 악세서리 종류는 자동으로 비워진다.
    """
    return await edit_service.update_clothing(db, storage, member_id, clothing_id, update)


@router.post(
    "/{clothing_id}/reviewed",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={404: {"description": "없는 옷이거나 본인 옷이 아님"}},
)
async def mark_clothing_reviewed(
    clothing_id: int,
    db: AsyncSession = Depends(get_db),
    member_id: int = Depends(get_current_member_id),
) -> None:
    """상세 화면에 들어갈 때 부른다. 신규 표시를 끈다 (FR-REG-16). 여러 번 불러도 같다."""
    await edit_service.mark_reviewed(db, member_id, clothing_id)


@router.put("/{clothing_id}/edit", response_model=ClothingDetail, responses=_EDIT_RESPONSES)
async def save_clothing_edit(
    clothing_id: int,
    edit: ClothingEditUpdate,
    db: AsyncSession = Depends(get_db),
    member_id: int = Depends(get_current_member_id),
    storage: ImageStorage = Depends(get_image_storage),
) -> ClothingDetail:
    """회전·원근 보정값 저장 (FR-EDIT-04·05). 원본 이미지와 브러시 마스크는 그대로 둔다."""
    return await edit_service.save_edit(db, storage, member_id, clothing_id, edit)


@router.put(
    "/{clothing_id}/edit/mask",
    response_model=ClothingDetail,
    responses={
        **_EDIT_RESPONSES,
        422: {
            "description": (
                "PNG가 아님 (CLOTHING_MASK_INVALID), 옷 이미지와 크기가 다름"
                " (CLOTHING_MASK_SIZE_MISMATCH), 용량 초과 (CLOTHING_MASK_TOO_LARGE)"
            )
        },
    },
)
async def save_clothing_mask(
    clothing_id: int,
    file: UploadFile = File(
        description="흑백 PNG. 흰색은 보이게, 검은색은 지우게. 크기는 옷 이미지와 같아야 한다."
    ),
    db: AsyncSession = Depends(get_db),
    member_id: int = Depends(get_current_member_id),
    storage: ImageStorage = Depends(get_image_storage),
) -> ClothingDetail:
    """브러시 마스크 저장 (FR-EDIT-03). 이전 마스크 파일은 지운다."""
    return await edit_service.save_mask(db, storage, member_id, clothing_id, file.file)


@router.delete("/{clothing_id}/edit", response_model=ClothingDetail, responses=_EDIT_RESPONSES)
async def reset_clothing_edit(
    clothing_id: int,
    db: AsyncSession = Depends(get_db),
    member_id: int = Depends(get_current_member_id),
    storage: ImageStorage = Depends(get_image_storage),
) -> ClothingDetail:
    """편집값 초기화. 회전·원근·마스크를 모두 지워 원래 이미지로 돌아간다 (FR-EDIT-06)."""
    return await edit_service.reset_edit(db, storage, member_id, clothing_id)
