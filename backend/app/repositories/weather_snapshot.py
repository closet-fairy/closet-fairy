"""weather_snapshot 저장 (REC-07). 세션당 1회."""

import json

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.weather.weather_service import WeatherResult

INSERT_SQL = text(
    """
    INSERT INTO weather_snapshot (
        recommendation_session_id, temperature, feels_like_temperature,
        precipitation, wind_speed, weather_condition_cd, hourly_forecast, is_fallback
    ) VALUES (
        :recommendation_session_id, :temperature, :feels_like_temperature,
        :precipitation, :wind_speed, :weather_condition_cd, :hourly_forecast, :is_fallback
    )
    """
)


async def insert_weather_snapshot(
    db: AsyncSession, recommendation_session_id: int, weather: WeatherResult
) -> None:
    await db.execute(
        INSERT_SQL,
        {
            "recommendation_session_id": recommendation_session_id,
            "temperature": weather.temperature,
            "feels_like_temperature": weather.feels_like_temperature,
            "precipitation": weather.precipitation,
            "wind_speed": weather.wind_speed,
            "weather_condition_cd": weather.weather_condition_cd,
            "hourly_forecast": json.dumps(weather.hourly_json()),
            "is_fallback": weather.is_fallback,
        },
    )
    await db.commit()
