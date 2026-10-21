from typing import Literal

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, field_validator

from app.schemas.codes import StyleCd

NICKNAME_MAX_LENGTH = 30

ProviderCd = Literal["google", "kakao"]
TemperatureSensitivityCd = Literal["cold_sensitive", "normal", "heat_sensitive"]
GenderCd = Literal["male", "female", "unisex"]


class MemberMe(BaseModel):
    nickname: str
    provider_cd: ProviderCd = Field(description="연결된 소셜 로그인")
    created_at: AwareDatetime = Field(description="가입 시각 (KST)")
    is_onboarded: bool


class MemberUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    nickname: str = Field(
        description=f"앞뒤 공백을 지운 뒤 1~{NICKNAME_MAX_LENGTH}자. 다른 회원과 같아도 된다.",
        examples=["옷장요정"],
    )

    @field_validator("nickname")
    @classmethod
    def check_nickname(cls, v: str) -> str:
        nickname = v.strip()
        if not 1 <= len(nickname) <= NICKNAME_MAX_LENGTH:
            raise ValueError(f"닉네임은 1~{NICKNAME_MAX_LENGTH}자로 입력해 주세요.")
        return nickname


class MemberSettings(BaseModel):
    birth_year: int | None = Field(description="온보딩 전이면 null")
    temperature_sensitivity_cd: TemperatureSensitivityCd | None
    gender_cd: GenderCd
    style_cds: list[StyleCd]
    is_onboarded: bool


class MemberSettingsUpdate(BaseModel):
    """전체를 바꾼다. 보내지 않은 선택 항목은 비워진다."""

    model_config = ConfigDict(extra="forbid")

    birth_year: int = Field(
        ge=1, description="만 14세 미만으로 볼 수 있는 해(올해 - 14 이후)는 422", examples=[1999]
    )
    temperature_sensitivity_cd: TemperatureSensitivityCd | None = None
    gender_cd: GenderCd | None = Field(default=None, description="비우면 unisex")
    style_cds: list[StyleCd] = Field(
        default_factory=list, description="개수 제한 없음. 처음 고른 스타일에만 선호 점수 +5"
    )
