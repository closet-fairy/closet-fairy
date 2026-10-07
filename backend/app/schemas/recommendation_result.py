"""추천 결과 조회(폴링) 응답 (REC-17)."""

from typing import Literal

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field

from app.schemas.recommendation_session import TpoCd
from app.schemas.weather import WeatherConditionCd

GenerationStatusCd = Literal["processing", "completed", "failed"]
SessionStatusCd = Literal["active", "completed", "canceled", "abandoned"]
SeasonCd = Literal["spring", "summer", "fall", "winter"]
SlotCd = Literal["outer", "top", "bottom", "shoes", "socks", "accessories"]
AccessoryTypeCd = Literal["hat", "bag", "belt", "watch", "scarf", "eyewear", "jewelry", "etc"]
ItemSourceCd = Literal["owned", "essential"]
OutfitTypeCd = Literal["preferred", "exploratory"]
StyleCd = Literal[
    "minimal",
    "casual",
    "street",
    "classic",
    "formal",
    "sporty",
    "romantic",
    "vintage",
    "bohemian",
    "preppy",
    "chic",
    "unique",
    "feminine",
]


class OutfitItemResult(BaseModel):
    slot_cd: SlotCd = Field(
        description=(
            "착용 슬롯. 아이템은 outer → top → bottom → shoes → socks → accessories 순으로 온다."
        )
    )
    accessory_type_cd: AccessoryTypeCd | None = Field(
        description=(
            "악세서리 세부 종류. slot_cd가 accessories일 때만 값이 있다. "
            "회원이 그 옷을 지우면 accessories여도 null일 수 있다."
        )
    )
    item_source_cd: ItemSourceCd = Field(
        description=(
            "owned면 회원이 등록한 옷, essential이면 옷장을 보충하려고 넣은 기본 아이템이다."
        )
    )
    item_name: str = Field(description="추천 당시 이름. 옷을 나중에 지워도 그대로 남는다.")
    image_url: str | None = Field(
        description="추천 당시 이미지. 보유 옷은 배경 제거본이 있으면 그것, 없으면 원본이다."
    )
    style_cds: list[StyleCd] = Field(description="스타일 태그. 없으면 빈 배열이다.")


class OutfitResult(BaseModel):
    outfit_id: int = Field(description="별점을 매길 때 이 값을 보낸다.")
    outfit_seq: int = Field(ge=1, le=4, description="화면에 보여줄 순서.")
    outfit_type_cd: OutfitTypeCd = Field(
        description=(
            "preferred는 선호 스타일 코디, "
            "exploratory는 새 스타일을 시도해보는 탐색 코디(최대 1벌)."
        )
    )
    reason: str | None = Field(description="추천 사유.")
    items: list[OutfitItemResult]


class SessionCondition(BaseModel):
    tpo_cd: TpoCd
    tpo_text: str | None = Field(description="tpo_cd가 custom일 때 회원이 직접 입력한 상황.")
    season_cd: SeasonCd = Field(description="요청 시점의 기온 추세로 판정한 계절.")
    going_out_start_at: AwareDatetime = Field(description="외출 시작 시각 (KST, +09:00).")
    going_out_end_at: AwareDatetime = Field(
        description="외출 종료 시각 (KST, +09:00). 자정을 넘기면 다음 날짜로 온다."
    )


class SessionWeather(BaseModel):
    temperature: float
    feels_like_temperature: float
    weather_condition_cd: WeatherConditionCd
    is_fallback: bool = Field(
        description=(
            "true면 기상청 조회에 실패해 대체값으로 추천한 것이다. 날씨가 추정값임을 표시한다."
        )
    )


class RecommendationResult(BaseModel):
    recommendation_session_id: int
    generation_status_cd: GenerationStatusCd = Field(
        description=(
            "processing이면 아직 만드는 중이라 outfits가 빈 배열이다. 잠시 뒤 다시 조회한다. "
            "completed면 outfits가 채워져 있다. "
            "failed면 추천을 만들지 못한 것이므로 폴링을 멈추고 다시 시도를 안내한다."
        )
    )
    session_status_cd: SessionStatusCd = Field(
        description=(
            "active는 별점을 아직 안 매긴 상태, completed는 별점을 매겨 끝난 상태, "
            "canceled는 조건 입력으로 돌아가 취소한 상태, "
            "abandoned는 오래 활동이 없어 종료된 상태다."
        )
    )
    is_clothing_shortage: bool = Field(
        description=(
            "true면 옷장에 추천할 옷이 부족한 상태다. "
            "결과 화면에 등록 유도 안내를 띄운다. "
            "에센셜 아이템이 섞였는지는 items[].item_source_cd로 판단한다."
        )
    )
    condition: SessionCondition
    weather: SessionWeather | None = Field(
        description="추천 시점 날씨. 날씨를 아직 조회하기 전이면 null이다."
    )
    outfits: list[OutfitResult] = Field(
        description=(
            "outfit_seq 순. completed면 1~4벌이다. "
            "보통 4벌이지만 옷장 사정에 따라 더 적을 수 있다."
        )
    )

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "recommendation_session_id": 12,
                    "generation_status_cd": "completed",
                    "session_status_cd": "active",
                    "is_clothing_shortage": True,
                    "condition": {
                        "tpo_cd": "work",
                        "tpo_text": None,
                        "season_cd": "fall",
                        "going_out_start_at": "2026-10-08T08:00:00+09:00",
                        "going_out_end_at": "2026-10-08T19:00:00+09:00",
                    },
                    "weather": {
                        "temperature": 14.2,
                        "feels_like_temperature": 12.8,
                        "weather_condition_cd": "cloudy",
                        "is_fallback": False,
                    },
                    "outfits": [
                        {
                            "outfit_id": 101,
                            "outfit_seq": 1,
                            "outfit_type_cd": "preferred",
                            "reason": "아침이 쌀쌀해 블레이저를 걸치고 슬랙스로 맞췄어요.",
                            "items": [
                                {
                                    "slot_cd": "outer",
                                    "accessory_type_cd": None,
                                    "item_source_cd": "owned",
                                    "item_name": "네이비 블레이저",
                                    "image_url": "https://example.com/clothing/1042/cutout.png",
                                    "style_cds": ["minimal", "classic"],
                                },
                                {
                                    "slot_cd": "top",
                                    "accessory_type_cd": None,
                                    "item_source_cd": "owned",
                                    "item_name": "화이트 옥스퍼드 셔츠",
                                    "image_url": "https://example.com/clothing/2001/cutout.png",
                                    "style_cds": ["classic", "preppy"],
                                },
                                {
                                    "slot_cd": "bottom",
                                    "accessory_type_cd": None,
                                    "item_source_cd": "owned",
                                    "item_name": "블랙 슬랙스",
                                    "image_url": "https://example.com/clothing/3001/cutout.png",
                                    "style_cds": ["minimal"],
                                },
                                {
                                    "slot_cd": "shoes",
                                    "accessory_type_cd": None,
                                    "item_source_cd": "essential",
                                    "item_name": "블랙 로퍼",
                                    "image_url": "https://example.com/essential/21.png",
                                    "style_cds": ["classic"],
                                },
                            ],
                        }
                    ],
                },
                {
                    "recommendation_session_id": 13,
                    "generation_status_cd": "processing",
                    "session_status_cd": "active",
                    "is_clothing_shortage": False,
                    "condition": {
                        "tpo_cd": "custom",
                        "tpo_text": "친구 결혼식 2부 파티",
                        "season_cd": "fall",
                        "going_out_start_at": "2026-10-08T18:00:00+09:00",
                        "going_out_end_at": "2026-10-09T01:00:00+09:00",
                    },
                    "weather": None,
                    "outfits": [],
                },
            ]
        }
    )
