"""ASOS 일자료 API 클라이언트. 일별 평균기온(daily_weather)용."""
from datetime import date
from decimal import Decimal, InvalidOperation

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
    """[(날짜, 평균기온)] 목록. 결측치는 건너뛴다."""
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
            avg_str = str(item.get("avgTa", "")).strip()
            if not avg_str or avg_str == "-":
                continue
            try:
                rows.append((date.fromisoformat(item["tm"]), Decimal(avg_str)))
            except InvalidOperation:
                continue
        if page * PAGE_SIZE >= total:
            break
        page += 1
    return rows