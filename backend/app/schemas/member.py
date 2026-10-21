from typing import Literal

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, field_validator

NICKNAME_MAX_LENGTH = 30

ProviderCd = Literal["google", "kakao"]


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
