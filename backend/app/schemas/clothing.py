from typing import Any, Literal

from pydantic import AwareDatetime, BaseModel, Field

from app.schemas.recommendation_result import AccessoryTypeCd, SeasonCd, SlotCd, StyleCd

ProcessingStatusCd = Literal["processing", "completed", "failed"]
CategoryCd = SlotCd
ColorCd = Literal[
    "black",
    "white",
    "gray",
    "beige",
    "brown",
    "navy",
    "blue",
    "sky_blue",
    "green",
    "khaki",
    "yellow",
    "orange",
    "red",
    "pink",
]
ThicknessCd = Literal["thin", "medium", "thick"]

RejectReasonCd = Literal["unsupported_format", "too_large", "resolution_too_high", "unreadable"]


class UploadedClothing(BaseModel):
    clothing_id: int
    processing_status_cd: Literal["processing"]
    image_url: str = Field(examples=["/media/clothing/1/3f2a9c0e8b1d4e6f.webp"])
    file_name: str | None = Field(examples=["IMG_0001.HEIC"])


class RejectedUpload(BaseModel):
    file_name: str | None = Field(examples=["a.gif"])
    reason_cd: RejectReasonCd
    message: str = Field(examples=["JPG, PNG, WEBP, HEIC 사진만 올릴 수 있습니다."])


class ClothingUploadResult(BaseModel):
    accepted: list[UploadedClothing] = Field(
        description="옷으로 등록된 사진. 배경 제거·태깅은 이후 비동기로 진행된다."
    )
    rejected: list[RejectedUpload] = Field(description="형식·용량·해상도 때문에 제외된 사진과 사유")


class ClothingProgress(BaseModel):
    clothing_id: int
    processing_status_cd: ProcessingStatusCd
    is_queued: bool = Field(
        description="처리 중인데 아직 차례를 기다리면 true. 처리가 시작됐거나 끝났으면 false."
    )
    image_url: str = Field(
        description="카드에 보여줄 이미지. 배경 제거본이 있으면 그것, 없으면 원본이다.",
        examples=["/media/clothing/1/3f2a9c0e8b1d4e6f.webp"],
    )
    failure_reason: str | None = Field(
        description="failed일 때만 값이 있다. 화면에 그대로 보여줘도 되는 문구다."
    )


class ClothingStatusList(BaseModel):
    items: list[ClothingProgress] = Field(
        description="요청한 id 중 회원의 옷만 담는다. 없는 옷·다른 회원의 옷은 빠진다."
    )


class ClothingCard(ClothingProgress):
    is_new: bool = Field(description="회원이 아직 확인하지 않은 옷이면 true. 신규 표시에 쓴다.")
    category_cd: CategoryCd | None = Field(description="태깅 전이거나 실패하면 null이다.")
    item_name: str | None
    created_at: AwareDatetime = Field(description="등록 시각 (KST)")


class ClothingPage(BaseModel):
    items: list[ClothingCard] = Field(description="등록 역순")
    next_cursor: int | None = Field(
        description="다음 페이지를 받을 때 cursor로 보낸다. 더 없으면 null이다."
    )


class ClothingEdit(BaseModel):
    rotation_angle: float = Field(description="평면 회전 각도 -180~180")
    perspective_param: Any | None = Field(description="원근 보정 파라미터. 미적용이면 null")
    brush_mask_url: str | None = Field(description="브러시 마스크 이미지. 미보정이면 null")


class ClothingDetail(ClothingCard):
    origin_image_url: str
    cutout_image_url: str | None = Field(description="배경 제거 전이면 null이다.")
    accessory_type_cd: AccessoryTypeCd | None
    color_cd: ColorCd | None
    color_text: str | None = Field(description="색상 표시용 원문")
    thickness_cd: ThicknessCd | None
    is_waterproof: bool | None = Field(description="null이면 모름")
    style_cds: list[StyleCd]
    season_cds: list[SeasonCd]
    edit: ClothingEdit | None = Field(description="편집한 적이 없으면 null이다.")
