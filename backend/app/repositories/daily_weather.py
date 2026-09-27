from datetime import date
from decimal import Decimal

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

# PK(region_cd, weather_dt)가 같으면 새로 넣지 않고 값만 갱신 → 두 번 돌려도 행 수가 그대로
UPSERT_SQL = text(
    """
    INSERT INTO daily_weather (region_cd, weather_dt, avg_temperature)
    VALUES (:region_cd, :weather_dt, :avg_temperature) AS new
    ON DUPLICATE KEY UPDATE avg_temperature = new.avg_temperature
    """
)


async def upsert_daily_weather(
    db: AsyncSession, region_cd: str, rows: list[tuple[date, Decimal]]
) -> int:
    if not rows:
        return 0
    await db.execute(
        UPSERT_SQL,
        [{"region_cd": region_cd, "weather_dt": d, "avg_temperature": t} for d, t in rows],
    )
    await db.commit()
    return len(rows)
