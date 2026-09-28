"""17개 지점의 일평균 기온을 기간 단위로 받아 daily_weather에 넣는다.
백필 스크립트와 일 1회 배치가 같이 쓴다."""

import logging
from datetime import date

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.repositories.daily_weather import upsert_daily_weather
from app.services.weather.asos_client import fetch_daily_avg_temperatures
from app.services.weather.regions import asos_station_codes

logger = logging.getLogger(__name__)


async def load_daily_weather(db: AsyncSession, start_dt: date, end_dt: date) -> dict[str, int]:
    """지점별 적재 건수를 돌려준다. 한 지점이 실패해도 나머지는 계속 진행 (-1로 표시)."""
    settings = get_settings()
    result: dict[str, int] = {}
    for station_cd in asos_station_codes():
        try:
            rows = await fetch_daily_avg_temperatures(
                station_cd, start_dt, end_dt, settings.KMA_SERVICE_KEY
            )
            result[station_cd] = await upsert_daily_weather(db, station_cd, rows)
        except Exception:  # noqa: BLE001 - 지점 하나 실패로 전체를 멈추지 않는다
            logger.exception("daily_weather.load.fail station=%s", station_cd)
            await db.rollback()
            result[station_cd] = -1
    return result
