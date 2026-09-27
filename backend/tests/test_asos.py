import asyncio
from datetime import date
from decimal import Decimal

import httpx

from app.services.weather.asos_client import fetch_daily_avg_temperatures
from app.services.weather.regions import asos_station_codes


def test_station_codes_are_17():
    assert len(asos_station_codes()) == 17


def test_fetch_parses_and_skips_missing():
    def handler(request):
        body = {
            "response": {
                "header": {"resultCode": "00", "resultMsg": "NORMAL_SERVICE"},
                "body": {
                    "items": {"item": [
                        {"tm": "2026-09-24", "stnId": "108", "avgTa": "21.3"},
                        {"tm": "2026-09-25", "stnId": "108", "avgTa": ""},  # 결측
                        {"tm": "2026-09-26", "stnId": "108", "avgTa": "19.8"},
                    ]},
                    "totalCount": 3,
                },
            }
        }
        return httpx.Response(200, json=body)

    rows = asyncio.run(
        fetch_daily_avg_temperatures(
            "108", date(2026, 9, 24), date(2026, 9, 26), "key", transport=httpx.MockTransport(handler)
        )
    )
    assert rows == [(date(2026, 9, 24), Decimal("21.3")), (date(2026, 9, 26), Decimal("19.8"))]


def test_fetch_no_data_is_empty():
    def handler(request):
        return httpx.Response(200, json={"response": {"header": {"resultCode": "03", "resultMsg": "NO_DATA"}}})

    rows = asyncio.run(
        fetch_daily_avg_temperatures(
            "108", date(2026, 9, 24), date(2026, 9, 26), "key", transport=httpx.MockTransport(handler)
        )
    )
    assert rows == []
