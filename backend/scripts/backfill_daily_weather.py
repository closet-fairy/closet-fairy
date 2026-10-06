"""과거 1년치 일평균 기온 일괄 적재. 처음 한 번만 실행.
실행: python -m scripts.backfill_daily_weather"""

import asyncio
from datetime import datetime, timedelta

from app.core.db import AsyncSessionLocal, engine
from app.services.weather.base_time import KST
from app.services.weather.daily_weather_loader import load_daily_weather

BACKFILL_DAYS = 365


async def main() -> None:
    yesterday = datetime.now(KST).date() - timedelta(days=1)
    start = yesterday - timedelta(days=BACKFILL_DAYS - 1)
    print(f"적재 기간: {start} ~ {yesterday}")
    async with AsyncSessionLocal() as db:
        result = await load_daily_weather(db, start, yesterday)
    await engine.dispose()
    for station_cd, count in result.items():
        print(f"  지점 {station_cd}: {'실패' if count < 0 else f'{count}건'}")


if __name__ == "__main__":
    asyncio.run(main())
