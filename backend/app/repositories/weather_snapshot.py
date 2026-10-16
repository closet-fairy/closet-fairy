"""weather_snapshot 저장·조회 (REC-07). 세션당 1회 저장."""

import json
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal

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


@dataclass(frozen=True)
class WeatherSnapshotRow:
    temperature: Decimal
    feels_like_temperature: Decimal
    precipitation: Decimal
    wind_speed: Decimal
    weather_condition_cd: str
    hourly_forecast: list[dict]
    is_fallback: bool
    created_at: datetime


SELECT_SQL = text(
    """
    SELECT temperature, feels_like_temperature, precipitation, wind_speed,
           weather_condition_cd, hourly_forecast, is_fallback, created_at
    FROM weather_snapshot
    WHERE recommendation_session_id = :recommendation_session_id
    """
)


async def get_weather_snapshot(
    db: AsyncSession, recommendation_session_id: int
) -> WeatherSnapshotRow | None:
    row = (
        await db.execute(SELECT_SQL, {"recommendation_session_id": recommendation_session_id})
    ).first()
    if row is None:
        return None
    hourly = row.hourly_forecast
    if isinstance(hourly, str):
        hourly = json.loads(hourly)
    return WeatherSnapshotRow(
        temperature=row.temperature,
        feels_like_temperature=row.feels_like_temperature,
        precipitation=row.precipitation,
        wind_speed=row.wind_speed,
        weather_condition_cd=row.weather_condition_cd,
        hourly_forecast=hourly or [],
        is_fallback=bool(row.is_fallback),
        created_at=row.created_at,
    )
