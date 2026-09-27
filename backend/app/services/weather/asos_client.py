"""ASOS 일자료 API — 지점별 일평균 기온. 계절 판정(daily_weather)용."""
from datetime import date
from decimal import Decimal

import httpx

from app.services.weather.kma_http import request_items

ASOS_URL = "https://apis.data.go.kr/1360000/AsosDalyInfoService/getWthrDataList"
PAGE_SIZE = 999


async def fetch_daily_avg_temperatures(
    station_cd: str,
    start_dt: date,
    end_dt: date,
    service_key: str,
    timeout: float = 10.0,
    transport: httpx.AsyncBaseTransport | None = None,
) -> list[tuple[date, Decimal]]:
    """[(날짜, 일평균기온)] — end_dt는 어제까지만 가능 (ASOS는 전날 자료까지 제공)."""
    rows: list[tuple[date, Decimal]] = []
    page = 1
    while True:
        items, total = await request_items(
            ASOS_URL,
            {
                "pageNo": page,
                "numOfRows": PAGE_SIZE,
                "dataCd": "ASOS",
                "dateCd": "DAY",
                "startDt": start_dt.strftime("%Y%m%d"),
                "endDt": end_dt.strftime("%Y%m%d"),
                "stnIds": station_cd,
            },
            service_key,
            timeout,
            transport,
        )
        for item in items:
            avg = item.get("avgTa")
            if avg in (None, ""):  # 결측일은 건너뛴다
                continue
            rows.append((date.fromisoformat(item["tm"]), Decimal(str(avg))))
        if page * PAGE_SIZE >= total:
            break
        page += 1
    return rows
