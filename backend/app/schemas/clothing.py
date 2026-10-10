from typing import Literal

from pydantic import BaseModel, Field

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
