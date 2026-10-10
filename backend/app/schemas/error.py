from pydantic import BaseModel, Field


class ErrorResponse(BaseModel):
    code: str = Field(examples=["VALIDATION_ERROR"])
    message: str = Field(examples=["외출 시간은 30분 단위로 입력해 주세요."])
