from pydantic import BaseModel, Field


class WithdrawalStarted(BaseModel):
    authorize_url: str = Field(description="이 주소로 이동해 가입한 소셜 계정으로 다시 로그인한다.")
