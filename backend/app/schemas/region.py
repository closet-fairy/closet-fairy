from pydantic import BaseModel, ConfigDict, Field


class SidoRegions(BaseModel):
    sido_nm: str = Field(examples=["서울특별시"])
    sigungu_nms: list[str] = Field(examples=[["종로구", "중구", "성동구"]])


class Coordinates(BaseModel):
    model_config = ConfigDict(extra="forbid")

    lat: float = Field(ge=-90, le=90, examples=[35.1587])
    lon: float = Field(ge=-180, le=180, examples=[129.1604])


class RegionName(BaseModel):
    sido_nm: str = Field(examples=["서울특별시"])
    sigungu_nm: str = Field(examples=["중구"])
