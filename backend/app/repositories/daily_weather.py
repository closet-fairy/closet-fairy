from datetime import date
from decimal import Decimal

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

# PK(region_cd, weather_dt)가 같으면 새로 넣지 않고 값만 갱신. 몇 번 다시 돌려도 안전하게 그대로.
UPSERT_SQL = text(
    """
    INSERT INTO daily_weather (region_cd, weather_dt, avg_temperature)
    VALUES (:region_cd, :weather_dt, :avg_temperature)
    ON DUPLICATE KEY UPDATE avg_temperature = VALUES(avg_temperature)
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


RECENT_AVG_TEMPERATURES_SQL = text(
    """
    SELECT weather_dt, avg_temperature
    FROM daily_weather
    WHERE region_cd = :region_cd AND weather_dt <= :end_date
    ORDER BY weather_dt DESC
    LIMIT :days
    """
)


async def get_recent_avg_temperatures(
    db: AsyncSession, region_cd: str, end_date: date, days: int
) -> list[tuple[date, Decimal]]:
    """region_cd의 end_date 이전(포함) 최근 days일치 평균기온을, 날짜 오름차순으로 반환한다."""
    result = await db.execute(
        RECENT_AVG_TEMPERATURES_SQL,
        {"region_cd": region_cd, "end_date": end_date, "days": days},
    )
    rows = result.all()
    return [(row.weather_dt, row.avg_temperature) for row in reversed(rows)]
