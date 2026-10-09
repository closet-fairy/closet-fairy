from datetime import time
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

from app.services.input_guard import is_harmful

TpoCd = Literal["daily", "work", "formal", "exercise", "rainy", "midwinter", "custom"]
TPO_TEXT_MAX_LENGTH = 100


class RecommendationSessionCreate(BaseModel):
    sido_nm: str = Field(min_length=1, max_length=20, examples=["서울특별시"])
    sigungu_nm: str = Field(min_length=1, max_length=30, examples=["성동구"])
    location_input_type_cd: Literal["current", "manual"]
    tpo_cd: TpoCd
    tpo_text: str | None = Field(default=None, max_length=TPO_TEXT_MAX_LENGTH)
    going_out_start_time: time = Field(examples=["15:00"])
    going_out_end_time: time = Field(examples=["21:30"])

    @field_validator("going_out_start_time", "going_out_end_time")
    @classmethod
    def check_half_hour(cls, v: time) -> time:
        if v.minute not in (0, 30) or v.second or v.microsecond:
            raise ValueError("외출 시간은 30분 단위로 입력해 주세요.")
        return v

    @model_validator(mode="after")
    def check_tpo_and_period(self) -> "RecommendationSessionCreate":
        if self.tpo_cd == "custom":
            text = (self.tpo_text or "").strip()
            if not text:
                raise ValueError("직접 입력을 골랐다면 상황을 적어 주세요.")
            if is_harmful(text):
                raise ValueError("입력할 수 없는 내용이 포함되어 있습니다.")
            self.tpo_text = text
        else:
            self.tpo_text = None  # 프리셋이면 텍스트는 버린다 (DB 제약과 동일)

        if self.going_out_start_time == self.going_out_end_time:
            raise ValueError("외출 시작과 종료 시각이 같습니다.")
        return self

    @property
    def tpo_input_type_cd(self) -> str:
        return "custom" if self.tpo_cd == "custom" else "preset"


class RecommendationSessionCreated(BaseModel):
    recommendation_session_id: int
    session_status_cd: str


class RatingCreate(BaseModel):
    outfit_id: int = Field(gt=0)
    rating: int = Field(ge=1, le=5)


class RatingResult(BaseModel):
    recommendation_session_id: int
    outfit_id: int
    rating: int
    session_status_cd: str


class CancelResult(BaseModel):
    recommendation_session_id: int
    session_status_cd: Literal["canceled", "abandoned"] = Field(
        description=(
            "canceled면 이번 요청으로 취소됐거나 이미 취소된 세션이다. "
            "abandoned면 오래 활동이 없어 이미 종료된 세션이다. "
            "어느 쪽이든 점수는 반영되지 않았으므로 조건 입력 화면으로 이동하면 된다."
        )
    )
