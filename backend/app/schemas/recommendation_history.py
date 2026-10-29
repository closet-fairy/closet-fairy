"""추천 내역 목록 응답 (#173)."""

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field

from app.schemas.codes import CategoryCd
from app.schemas.recommendation_result import SessionCondition, SessionWeather


class RecommendationHistoryThumbnail(BaseModel):
    slot_cd: CategoryCd = Field(
        description=(
            "착용 슬롯. 아이템은 outer → top → bottom → shoes → socks → accessories 순으로 온다."
        )
    )
    item_name: str = Field(description="추천 당시 이름. 옷을 나중에 지워도 그대로 남는다.")
    image_url: str | None = Field(
        description=(
            "추천 당시 이미지. 옷을 나중에 지워도 그대로 보인다. "
            "이미지가 없는 기본 아이템이면 null이므로 item_name으로 대신 보여준다."
        )
    )


class RecommendationHistoryCondition(SessionCondition):
    sido_nm: str = Field(description="추천받을 때 고른 시/도. 저장된 이름 그대로 온다.")
    sigungu_nm: str = Field(
        description=(
            "추천받을 때 고른 시/군/구. 저장된 이름 그대로 온다. "
            "세종은 sido_nm과 같은 세종특별자치시다."
        )
    )


class RecommendationHistoryBase(BaseModel):
    recommendation_session_id: int
    recommended_at: AwareDatetime = Field(description="추천받은 시각 (KST, +09:00).")
    condition: RecommendationHistoryCondition
    weather: SessionWeather | None = Field(
        description="추천 시점 날씨. 날씨를 조회하지 못한 채 끝난 세션이면 null이다."
    )
    rating: int = Field(ge=1, le=5, description="매긴 별점.")


class RecommendationHistoryItem(RecommendationHistoryBase):
    thumbnails: list[RecommendationHistoryThumbnail] = Field(
        description="별점을 매긴 코디의 아이템."
    )


class RecommendationHistoryPage(BaseModel):
    items: list[RecommendationHistoryItem] = Field(
        description="별점을 매겨 끝난 추천만, 최근 추천부터 온다. 없으면 빈 배열이다."
    )
    next_cursor: int | None = Field(
        description="다음 페이지를 받을 때 cursor로 보낸다. 더 없으면 null이다."
    )

    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {
                    "items": [
                        {
                            "recommendation_session_id": 41,
                            "recommended_at": "2026-10-27T07:42:10+09:00",
                            "condition": {
                                "tpo_cd": "work",
                                "tpo_text": None,
                                "season_cd": "fall",
                                "going_out_start_at": "2026-10-27T08:30:00+09:00",
                                "going_out_end_at": "2026-10-27T19:00:00+09:00",
                                "sido_nm": "서울특별시",
                                "sigungu_nm": "성동구",
                            },
                            "weather": {
                                "temperature": 11.4,
                                "feels_like_temperature": 9.8,
                                "weather_condition_cd": "clear",
                                "is_fallback": False,
                            },
                            "rating": 4,
                            "thumbnails": [
                                {
                                    "slot_cd": "outer",
                                    "item_name": "네이비 블레이저",
                                    "image_url": "/media/clothing/7/1042_cutout.webp",
                                },
                                {
                                    "slot_cd": "top",
                                    "item_name": "화이트 옥스퍼드 셔츠",
                                    "image_url": "/media/clothing/7/2001_cutout.webp",
                                },
                                {
                                    "slot_cd": "bottom",
                                    "item_name": "블랙 슬랙스",
                                    "image_url": "/media/clothing/7/3001_cutout.webp",
                                },
                                {
                                    "slot_cd": "shoes",
                                    "item_name": "블랙 로퍼",
                                    "image_url": None,
                                },
                            ],
                        },
                        {
                            "recommendation_session_id": 38,
                            "recommended_at": "2026-10-25T17:05:33+09:00",
                            "condition": {
                                "tpo_cd": "custom",
                                "tpo_text": "친구 결혼식 2부 파티",
                                "season_cd": "fall",
                                "going_out_start_at": "2026-10-25T18:00:00+09:00",
                                "going_out_end_at": "2026-10-26T01:00:00+09:00",
                                "sido_nm": "세종특별자치시",
                                "sigungu_nm": "세종특별자치시",
                            },
                            "weather": None,
                            "rating": 5,
                            "thumbnails": [
                                {
                                    "slot_cd": "top",
                                    "item_name": "아이보리 니트",
                                    "image_url": "/media/clothing/7/2003_cutout.webp",
                                },
                                {
                                    "slot_cd": "bottom",
                                    "item_name": "베이지 와이드 팬츠",
                                    "image_url": "/media/clothing/7/3004_cutout.webp",
                                },
                                {
                                    "slot_cd": "shoes",
                                    "item_name": "화이트 스니커즈",
                                    "image_url": "/media/clothing/7/4004_cutout.webp",
                                },
                            ],
                        },
                    ],
                    "next_cursor": 38,
                }
            ]
        }
    )
