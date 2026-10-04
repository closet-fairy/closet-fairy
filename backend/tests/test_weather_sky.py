"""REC-01 현재 하늘상태(SKY) 선택 테스트."""

from datetime import datetime, timedelta

from app.services.weather.base_time import KST
from app.services.weather.weather_service import combine, nearest_sky

NOW = datetime(2026, 10, 4, 17, 20, tzinfo=KST)


def _sky(hhmm: str, value: int, date: str = "20261004") -> dict:
    return {"category": "SKY", "fcstDate": date, "fcstTime": hhmm, "fcstValue": str(value)}


def _ncst(pty: str = "0") -> list[dict]:
    return [
        {"category": "T1H", "obsrValue": "20.0"},
        {"category": "WSD", "obsrValue": "1.0"},
        {"category": "PTY", "obsrValue": pty},
    ]


def _combine(fcst: list[dict], pty: str = "0"):
    return combine(_ncst(pty), fcst, NOW, NOW + timedelta(hours=1), NOW)


def test_nearest_sky_picks_closest_forecast_time_not_first():
    # 17:20 조회 → 첫 항목(15시)이 아니라 가장 가까운 17시 값을 써야 한다
    fcst = [_sky("1500", 1), _sky("1600", 3), _sky("1700", 4), _sky("1800", 1)]

    assert nearest_sky(fcst, NOW) == 4


def test_nearest_sky_crosses_midnight():
    now = datetime(2026, 10, 4, 23, 40, tzinfo=KST)
    fcst = [_sky("2300", 1), _sky("0000", 4, date="20261005")]

    assert nearest_sky(fcst, now) == 4


def test_nearest_sky_returns_none_without_sky_items():
    assert nearest_sky([], NOW) is None


def test_combine_uses_nearest_sky_for_current_condition():
    fcst = [_sky("1500", 1), _sky("1700", 4)]

    assert _combine(fcst).weather_condition_cd == "overcast"


def test_combine_precipitation_from_observation_still_takes_priority():
    fcst = [_sky("1700", 1)]

    assert _combine(fcst, pty="1").weather_condition_cd == "rain"


def test_combine_marks_sky_missing_when_forecast_is_empty():
    # 단기예보가 resultCode=03(데이터 없음)으로 빈 목록일 때
    result = _combine([])

    assert result.weather_condition_cd == "clear"
    assert result.is_sky_missing is True
    assert result.is_fallback is False


def test_combine_sky_missing_is_false_when_precipitating():
    # 비가 오는 중이면 SKY가 없어도 "비"는 정확하므로 표시하지 않는다
    result = _combine([], pty="1")

    assert result.weather_condition_cd == "rain"
    assert result.is_sky_missing is False


def test_combine_sky_missing_is_false_when_sky_present():
    assert _combine([_sky("1700", 1)]).is_sky_missing is False
