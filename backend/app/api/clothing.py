from fastapi import APIRouter, Depends, File, Query, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_bg_removal_worker, get_current_member_id, limit_clothing_requests
from app.core.db import get_db
from app.schemas.clothing import (
    ClothingDetail,
    ClothingEditUpdate,
    ClothingPage,
    ClothingProgress,
    ClothingStatusList,
    ClothingUpdate,
    ClothingUploadResult,
)
from app.services import clothing_delete as delete_service
from app.services import clothing_edit as edit_service
from app.services import clothing_query as query_service
from app.services import clothing_retry as retry_service
from app.services import clothing_upload as upload_service
from app.services.storage import ImageStorage, get_image_storage
from app.workers.bg_removal_worker import BgRemovalWorker

router = APIRouter(prefix="/clothing", tags=["clothing"])


@router.post(
    "",
    status_code=status.HTTP_202_ACCEPTED,
    response_model=ClothingUploadResult,
    dependencies=[Depends(limit_clothing_requests)],
    responses={429: {"description": "등록·재시도 요청이 너무 잦음"}},
)
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
    """회전·원근 보정값 저장 (FR-EDIT-04·05). 원본 이미지와 브러시 마스크는 그대로 두고,
    표시 이미지는 비운다."""
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
        description=(
            "흑백 PNG. 크기는 배경 제거본(없으면 원본)과 같아야 한다. 흰색은 원본을 그 가로·세로에 "
            "정확히 맞춰 줄인 이미지의 픽셀을 보이게, 검은색은 투명하게 한다."
        )
    ),
    db: AsyncSession = Depends(get_db),
    member_id: int = Depends(get_current_member_id),
    storage: ImageStorage = Depends(get_image_storage),
) -> ClothingDetail:
    """브러시 마스크 저장 (FR-EDIT-03). 이전 마스크 파일은 지우고 표시 이미지는 비운다."""
    return await edit_service.save_mask(db, storage, member_id, clothing_id, file.file)


@router.put(
    "/{clothing_id}/edit/display",
    response_model=ClothingDetail,
    responses={
        **_EDIT_RESPONSES,
        422: {"description": "형식·용량·해상도가 맞지 않음 (CLOTHING_DISPLAY_IMAGE_INVALID)"},
    },
)
async def save_clothing_display_image(
    clothing_id: int,
    file: UploadFile = File(
        description="마스크 → 원근 → 회전 순으로 편집을 모두 적용한 최종 이미지. PNG·WEBP 등"
    ),
    db: AsyncSession = Depends(get_db),
    member_id: int = Depends(get_current_member_id),
    storage: ImageStorage = Depends(get_image_storage),
) -> ClothingDetail:
    """표시 이미지 저장 (FR-EDIT-04·06). 옷장 목록과 추천 결과에 이 이미지를 쓴다.

    회전·원근이나 마스크를 저장하면 다시 비워지므로 편집을 저장한 뒤 마지막에 올린다.
    """
    return await edit_service.save_display_image(db, storage, member_id, clothing_id, file.file)


@router.delete("/{clothing_id}/edit", response_model=ClothingDetail, responses=_EDIT_RESPONSES)
async def reset_clothing_edit(
    clothing_id: int,
    db: AsyncSession = Depends(get_db),
    member_id: int = Depends(get_current_member_id),
    storage: ImageStorage = Depends(get_image_storage),
) -> ClothingDetail:
    """편집값 초기화. 회전·원근·마스크를 모두 지워 원래 이미지로 돌아간다 (FR-EDIT-06)."""
    return await edit_service.reset_edit(db, storage, member_id, clothing_id)


@router.delete(
    "/{clothing_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={404: {"description": "없는 옷이거나 본인 옷이 아님"}},
)
async def delete_clothing(
    clothing_id: int,
    db: AsyncSession = Depends(get_db),
    member_id: int = Depends(get_current_member_id),
    storage: ImageStorage = Depends(get_image_storage),
) -> None:
    """옷 영구 삭제 (FR-DEL). 처리 중·실패한 옷도 지울 수 있고, 진행 중이던 처리 결과는 버린다.

    별점을 준 코디에 쓰인 이미지는 추천 내역에 남긴다.
    """
    await delete_service.delete_clothing(db, storage, member_id, clothing_id)


@router.post(
    "/{clothing_id}/retry",
    status_code=status.HTTP_202_ACCEPTED,
    response_model=ClothingProgress,
    dependencies=[Depends(limit_clothing_requests)],
    responses={
        404: {"description": "없는 옷이거나 본인 옷이 아님"},
        409: {"description": "실패한 옷이 아님 (CLOTHING_NOT_RETRYABLE)"},
        429: {"description": "등록·재시도 요청이 너무 잦음"},
    },
)
async def retry_clothing(
    clothing_id: int,
    db: AsyncSession = Depends(get_db),
    member_id: int = Depends(get_current_member_id),
    storage: ImageStorage = Depends(get_image_storage),
    worker: BgRemovalWorker | None = Depends(get_bg_removal_worker),
) -> ClothingProgress:
    """실패한 옷을 배경 제거부터 다시 처리한다 (FR-REG-24). 업로드 직후처럼 상태를 폴링한다."""
    return await retry_service.retry_clothing(db, storage, member_id, clothing_id, worker)
