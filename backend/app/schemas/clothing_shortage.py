from pydantic import BaseModel, Field


class ClothingShortagePrecheckResponse(BaseModel):
    is_clothing_shortage: bool = Field(
        description="상의·하의·신발 중 하나라도 완료 상태 옷이 2벌 미만이면 true."
    )
    category_counts: dict[str, int] = Field(
        description=(
            "카테고리별 완료 상태 옷 개수. top, bottom, shoes 세 키를 항상 포함한다. "
            "처리 중·실패 옷과 분류가 없는 옷은 세지 않는다."
        ),
        examples=[{"top": 3, "bottom": 0, "shoes": 0}],
    )
    shortage_categories: list[str] = Field(
        description="2벌 미만인 카테고리. top, bottom, shoes 순서로 준다.",
        examples=[["bottom", "shoes"]],
    )
    notice_cd: str | None = Field(
        description=(
            "안내 문구 코드. 부족하면 clothing_shortage, 아니면 null. "
            "문구는 프론트가 정하며, 추천 결과 화면에서도 같은 코드를 쓴다."
        )
    )
