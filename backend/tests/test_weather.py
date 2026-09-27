import asyncio
from datetime import datetime

import httpx

from app.services.weather.base_time import KST, ultra_srt_ncst_base, vilage_fcst_base
from app.services.weather.feels_like import feels_like
from app.services.weather.grid import to_grid
from app.services.weather.kma_client import KmaClient
from app.services.weather.regions import find_region
from app.services.weather.weather_service import get_weather, parse_precipitation


def kst(y, mo, d, h, mi):
    return datetime(y, mo, d, h, mi, tzinfo=KST)


# ---------- 순수 함수 ----------

def test_grid_seoul_city_hall():
    assert to_grid(37.5665, 126.978) == (60, 127)


def test_find_region_falls_back_to_sido():
    region = find_region("서울특별시", "성동구")  # 시/군/구 행이 없으면 시/도 대표값
    assert (region.grid_nx, region.grid_ny) == (60, 127)


def test_ncst_base_time():
    assert ultra_srt_ncst_base(kst(2026, 9, 27, 14, 39)) == ("20260927", "1300")
    assert ultra_srt_ncst_base(kst(2026, 9, 27, 14, 40)) == ("20260927", "1400")
    assert ultra_srt_ncst_base(kst(2026, 9, 27, 0, 10)) == ("20260926", "2300")


def test_vilage_base_time():
    assert vilage_fcst_base(kst(2026, 9, 27, 14, 9)) == ("20260927", "1100")
    assert vilage_fcst_base(kst(2026, 9, 27, 14, 10)) == ("20260927", "1400")
    assert vilage_fcst_base(kst(2026, 9, 27, 2, 5)) == ("20260926", "2300")
    assert vilage_fcst_base(kst(2026, 9, 27, 23, 59)) == ("20260927", "2300")


def test_feels_like():
    assert feels_like(20.0, 5.0) == 20.0  # 10도 초과 → 그대로
    assert feels_like(0.0, 1.0) == 0.0  # 바람 약함 → 그대로
    assert feels_like(0.0, 5.0) < 0.0  # 추운 날 바람 → 더 춥게


def test_parse_precipitation():
    assert parse_precipitation("강수없음") == 0.0
    assert parse_precipitation("1mm 미만") == 0.5
    assert parse_precipitation("3.0mm") == 3.0
    assert parse_precipitation("30.0~50.0mm") == 30.0
    assert parse_precipitation("0") == 0.0


# ---------- API 호출 (가짜 응답) ----------

def _ok(items):
    return {
        "response": {
            "header": {"resultCode": "00", "resultMsg": "NORMAL_SERVICE"},
            "body": {"items": {"item": items}, "totalCount": len(items)},
        }
    }


NCST = [
    {"category": "T1H", "obsrValue": "12.0"},
    {"category": "RN1", "obsrValue": "0"},
    {"category": "WSD", "obsrValue": "2.0"},
    {"category": "PTY", "obsrValue": "0"},
]


def _fcst(hour, tmp, wsd="3.0", pty="0", sky="1"):
    base = {"fcstDate": "20260927", "fcstTime": f"{hour:02d}00"}
    return [
        {**base, "category": "TMP", "fcstValue": tmp},
        {**base, "category": "WSD", "fcstValue": wsd},
        {**base, "category": "PTY", "fcstValue": pty},
        {**base, "category": "SKY", "fcstValue": sky},
        {**base, "category": "PCP", "fcstValue": "강수없음"},
    ]


FCST = _fcst(15, "12") + _fcst(16, "10") + _fcst(17, "8") + _fcst(18, "6") + _fcst(21, "2")


def _handler(request: httpx.Request) -> httpx.Response:
    if request.url.path.endswith("getUltraSrtNcst"):
        return httpx.Response(200, json=_ok(NCST))
    return httpx.Response(200, json=_ok(FCST))


def test_get_weather_success():
    client = KmaClient("key", transport=httpx.MockTransport(_handler))
    r = asyncio.run(
        get_weather(
            "서울특별시", "성동구",
            going_out_start=kst(2026, 9, 27, 15, 0),
            going_out_end=kst(2026, 9, 27, 18, 0),
            now=kst(2026, 9, 27, 14, 50),
            client=client,
        )
    )
    assert r.is_fallback is False
    assert r.temperature == 12.0
    assert len(r.hourly) == 5
    # 외출 15~18시 중 가장 추운 18시(6도, 풍속 3) — 21시(2도)는 범위 밖이라 제외
    assert r.min_feels_like_temperature == feels_like(6.0, 3.0)
    assert r.hourly_json()[0]["at"].startswith("2026-09-27T15:00")


def test_get_weather_fallback_on_timeout():
    def boom(request):
        raise httpx.ConnectTimeout("timeout")

    client = KmaClient("key", transport=httpx.MockTransport(boom))
    r = asyncio.run(get_weather("서울특별시", None, now=kst(2026, 9, 27, 14, 50), client=client))
    assert r.is_fallback is True
    assert r.temperature == 21.2  # 9월 평년값


def test_get_weather_fallback_on_key_error():
    # 키 오류는 JSON이 아니라 XML로 온다
    def xml(request):
        return httpx.Response(200, text="<OpenAPI_ServiceResponse>SERVICE_KEY_IS_NOT_REGISTERED_ERROR</OpenAPI_ServiceResponse>")

    client = KmaClient("key", transport=httpx.MockTransport(xml))
    r = asyncio.run(get_weather("서울특별시", None, now=kst(2026, 9, 27, 14, 50), client=client))
    assert r.is_fallback is True
