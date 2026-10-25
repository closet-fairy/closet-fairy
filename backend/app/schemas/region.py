from pydantic import BaseModel, Field


class SidoRegions(BaseModel):
    sido_nm: str = Field(examples=["서울특별시"])
    sigungu_nms: list[str] = Field(examples=[["종로구", "중구", "성동구"]])


class RegionName(BaseModel):
    sido_nm: str = Field(examples=["서울특별시"])
    sigungu_nm: str = Field(examples=["중구"])
