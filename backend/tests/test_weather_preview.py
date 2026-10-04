from datetime import datetime

import httpx
import pytest
from fastapi.testclient import TestClient

from app.api.deps import get_now
from app.core.db import get_db
from app.main import app
from app.services.weather import weather_service
from app.services.weather.base_time import KST
from app.services.weather.feels_like import feels_like
from app.services.weather.kma_client import KmaClient

FIXED_NOW = datetime(2026, 9, 27, 14, 50, tzinfo=KST)


def _ok(items):
    return {
        "response": {
            "header": {"resultCode": "00", "resultMsg": "NORMAL_SERVICE"},
            "body": {"items": {"item": items}, "totalCount": len(items)},
        }
    }


NCST = [
    {"category": "T1H", "obsrValue": "8.0"},
    {"category": "RN1", "obsrValue": "0"},
    {"category": "WSD", "obsrValue": "4.0"},
    {"category": "PTY", "obsrValue": "0"},
]


def _fcst(hour, tmp, sky):
    base = {"fcstDate": "20260927", "fcstTime": f"{hour:02d}00"}
    return [
        {**base, "category": "TMP", "fcstValue": tmp},
        {**base, "category": "WSD", "fcstValue": "3.0"},
        {**base, "category": "PTY", "fcstValue": "0"},
        {**base, "category": "SKY", "fcstValue": sky},
        {**base, "category": "PCP", "fcstValue": "강수없음"},
    ]


FCST = _fcst(15, "9", sky="3") + _fcst(16, "8", sky="4")


def _ok_handler(request: httpx.Request) -> httpx.Response:
    if request.url.path.endswith("getUltraSrtNcst"):
        return httpx.Response(200, json=_ok(NCST))
    return httpx.Response(200, json=_ok(FCST))


def _timeout_handler(request: httpx.Request) -> httpx.Response:
    raise httpx.ConnectTimeout("timeout")


@pytest.fixture
def make_client(monkeypatch):
    def fail_db():
        pytest.fail("미리보기는 DB에 접근하면 안 된다")

    def make(handler):
        requests = []

        def recording_handler(request: httpx.Request) -> httpx.Response:
            requests.append(request)
            return handler(request)

        def fake_kma_client(service_key, timeout):
            return KmaClient(service_key, timeout, transport=httpx.MockTransport(recording_handler))

        monkeypatch.setattr(weather_service, "KmaClient", fake_kma_client)
        client = TestClient(app)
        client.kma_requests = requests
        return client

    app.dependency_overrides[get_db] = fail_db
    app.dependency_overrides[get_now] = lambda: FIXED_NOW
    yield make
    app.dependency_overrides.clear()


def preview(client, **params):
    return client.get(
        "/weather/preview", params={"sido_nm": "서울특별시", "sigungu_nm": "성동구", **params}
    )


def test_preview_200(make_client):
    with make_client(_ok_handler) as client:
        res = preview(client)
    assert res.status_code == 200
    assert res.json() == {
        "temperature": 8.0,
        "feels_like_temperature": feels_like(8.0, 4.0),
        "weather_condition_cd": "cloudy",
        "is_fallback": False,
    }


def test_preview_uses_injected_now(make_client):
    with make_client(_ok_handler) as client:
        preview(client)
    params = {r.url.path.rsplit("/", 1)[-1]: r.url.params for r in client.kma_requests}
    assert params["getUltraSrtNcst"]["base_date"] == "20260927"
    assert params["getUltraSrtNcst"]["base_time"] == "1400"
    assert params["getVilageFcst"]["base_time"] == "1400"


def test_preview_fallback(make_client):
    with make_client(_timeout_handler) as client:
        res = preview(client)
    assert res.status_code == 200
    assert res.json() == {
        "temperature": 21.2,  # 9월 평년값
        "feels_like_temperature": 21.2,
        "weather_condition_cd": "clear",
        "is_fallback": True,
    }


def test_preview_unknown_sido_404(make_client):
    with make_client(_ok_handler) as client:
        res = preview(client, sido_nm="없는도")
    assert res.status_code == 404
    assert res.json()["code"] == "REGION_NOT_FOUND"
    assert client.kma_requests == []


def test_preview_unknown_sigungu_uses_sido(make_client):
    with make_client(_ok_handler) as client:
        known = preview(client, sigungu_nm="성동구")
        unknown = preview(client, sigungu_nm="없는구")
    assert unknown.status_code == 200
    assert unknown.json() == known.json()
    assert unknown.json()["is_fallback"] is False
    assert {(r.url.params["nx"], r.url.params["ny"]) for r in client.kma_requests} == {
        ("60", "127")
    }


def test_preview_sigungu_required_422(make_client):
    with make_client(_ok_handler) as client:
        res = client.get("/weather/preview", params={"sido_nm": "서울특별시"})
    assert res.status_code == 422
