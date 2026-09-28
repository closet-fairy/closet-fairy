"""일 1회 배치: 어제 하루치를 추가. 스케줄러 연결 전까지는 수동 실행.
실행: python -m app.workers.daily_weather_batch
전날 자료가 오전 늦게 올라올 수 있어 오전 11시 이후 실행을 권장."""

import asyncio
from datetime import datetime, timedelta

from app.core.db import AsyncSessionLocal, engine
from app.services.weather.base_time import KST
from app.services.weather.daily_weather_loader import load_daily_weather


async def run() -> dict[str, int]:
    yesterday = datetime.now(KST).date() - timedelta(days=1)
    async with AsyncSessionLocal() as db:
        return await load_daily_weather(db, yesterday, yesterday)


async def main() -> None:
    result = await run()
    await engine.dispose()
    print(result)


if __name__ == "__main__":
    asyncio.run(main())
