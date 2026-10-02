from datetime import date, timedelta
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
    WHERE region_cd = :region_cd
      AND weather_dt BETWEEN :start_date AND :end_date
    ORDER BY weather_dt DESC
    LIMIT :days
    """
)


async def get_recent_avg_temperatures(
    db: AsyncSession, region_cd: str, end_date: date, days: int
) -> list[tuple[date, Decimal]]:
    """region_cd의 end_date 이전(포함) days일 구간 평균기온을, 날짜 오름차순으로 반환한다.

    구간 하한(end_date - days + 1)을 걸어서, 중간에 빠진 날이 있어도 그만큼
    더 오래된 날짜를 끌어와 개수를 채우지 않는다. 행이 모자라면 호출부가
    데이터 부족으로 보고 월 기준 판정으로 대체한다.
    """
    start_date = end_date - timedelta(days=days - 1)
    result = await db.execute(
        RECENT_AVG_TEMPERATURES_SQL,
        {
            "region_cd": region_cd,
            "start_date": start_date,
            "end_date": end_date,
            "days": days,
        },
    )
    rows = result.all()
    return [(row.weather_dt, row.avg_temperature) for row in reversed(rows)]


LATEST_WEATHER_DATE_SQL = text(
    """
    SELECT MAX(weather_dt) AS latest_date
    FROM daily_weather
    WHERE region_cd = :region_cd AND weather_dt <= :end_date
    """
)


async def get_latest_available_date(
    db: AsyncSession, region_cd: str, end_date: date
) -> date | None:
    """region_cd의 end_date 이전(포함) 데이터 중 실제로 존재하는 가장 최근 날짜.

    배치가 아직 돌지 않아 "어제" 행이 없을 수 있으므로, 끝점을 고정하지 않고
    실제 최신 적재일을 찾아 그 날짜를 기준으로 이동평균을 계산한다.
    """
    result = await db.execute(
        LATEST_WEATHER_DATE_SQL, {"region_cd": region_cd, "end_date": end_date}
    )
    row = result.first()
    return row.latest_date if row else None
