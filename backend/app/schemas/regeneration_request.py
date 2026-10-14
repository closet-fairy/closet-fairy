from typing import Literal

from pydantic import BaseModel, Field, model_validator

from app.schemas.codes import CategoryCd

TargetScopeCd = Literal["single", "all"]


class RegenerationCreate(BaseModel):
    request_text: str = Field(examples=["좀 더 캐주얼하게"])
    target_scope_cd: TargetScopeCd
    target_outfit_id: int | None = Field(default=None, gt=0)
    target_slot_cd: CategoryCd | None = None

    @model_validator(mode="after")
    def check_target(self) -> "RegenerationCreate":
        if self.target_scope_cd == "single":
            if self.target_outfit_id is None:
                raise ValueError("다시 추천받을 코디를 골라 주세요.")
        elif self.target_outfit_id is not None or self.target_slot_cd is not None:
            raise ValueError("전체 재추천에는 코디나 아이템을 지정할 수 없습니다.")
        return self


class RegenerationCreated(BaseModel):
    recommendation_session_id: int
    regeneration_request_id: int
    request_seq: int
    regeneration_status_cd: Literal["processing"]
