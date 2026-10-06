from datetime import datetime

from fastapi import APIRouter, Depends, Query

from app.api.deps import get_now
from app.schemas.weather import WeatherPreview
from app.services.weather.weather_service import get_weather

router = APIRouter(prefix="/weather", tags=["weather"])


@router.get("/preview", response_model=WeatherPreview)
async def preview_weather(
    sido_nm: str = Query(min_length=1, max_length=20, examples=["서울특별시"]),
    sigungu_nm: str = Query(min_length=1, max_length=30, examples=["성동구"]),
    now: datetime = Depends(get_now),
) -> WeatherPreview:
    """추천 요청 전 현재 날씨 미리보기 (FR-REC-01-1). 결과는 저장하지 않는다."""
    weather = await get_weather(sido_nm, sigungu_nm, now=now)
    return WeatherPreview(
        temperature=weather.temperature,
        feels_like_temperature=weather.feels_like_temperature,
        weather_condition_cd=weather.weather_condition_cd,
        is_fallback=weather.is_fallback,
        is_sky_missing=weather.is_sky_missing,
    )
