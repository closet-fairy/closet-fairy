from dataclasses import replace
from datetime import datetime, timedelta

import pytest

from app.repositories import clothing as clothing_repo
from app.repositories import member_setting as member_setting_repo
from app.repositories import recommendation_session as session_repo
from app.repositories import weather_snapshot as weather_snapshot_repo
from app.repositories.clothing import ClothingCandidate
from app.repositories.member_setting import MemberSettingRow
from app.repositories.recommendation_session import SessionRow
from app.services import recommend_context as ctx_service
from app.services.weather.base_time import KST
from app.services.weather.weather_service import HourlyWeather, WeatherResult

FIXED_SESSION = SessionRow(
    member_id=1,
    sido_nm="서울특별시",
    sigungu_nm="성동구",
    going_out_start_at=datetime(2026, 9, 27, 6, 0),  # UTC naive, KST 15:00
    going_out_end_at=datetime(2026, 9, 27, 9, 0),  # UTC naive, KST 18:00
    season_cd="fall",
    tpo_cd="daily",
    tpo_text=None,
    tpo_input_type_cd="preset",
)

FAKE_WEATHER = WeatherResult(
    temperature=20.0,
    feels_like_temperature=19.0,
    precipitation=0.0,
    wind_speed=1.0,
    weather_condition_cd="clear",
    min_feels_like_temperature=18.0,
)


class _FakeDbSession:
    async def __aenter__(self):
        return None

    async def __aexit__(self, *exc_info):
        return False


def _fake_async_session_local():
    return _FakeDbSession()


@pytest.fixture
def common_mocks(monkeypatch):
    saved_snapshots = []

    async def fake_get_session(db, recommendation_session_id):
        return FIXED_SESSION

    async def fake_get_weather(sido_nm, sigungu_nm, going_out_start, going_out_end, now):
        return FAKE_WEATHER

    async def fake_insert_weather_snapshot(db, recommendation_session_id, weather, created_at):
        saved_snapshots.append((recommendation_session_id, weather, created_at))

    monkeypatch.setattr(ctx_service, "AsyncSessionLocal", _fake_async_session_local)
    monkeypatch.setattr(session_repo, "get_session", fake_get_session)
    monkeypatch.setattr(ctx_service, "get_weather", fake_get_weather)
    monkeypatch.setattr(
        weather_snapshot_repo, "insert_weather_snapshot", fake_insert_weather_snapshot
    )
    return saved_snapshots


async def test_context_filled_for_dev_member_without_setting(common_mocks, monkeypatch):
    async def fake_get_member_setting(db, member_id):
        return None

    async def fake_get_completed_clothing(db, member_id):
        return []

    monkeypatch.setattr(member_setting_repo, "get_member_setting", fake_get_member_setting)
    monkeypatch.setattr(clothing_repo, "get_completed_clothing", fake_get_completed_clothing)

    context = await ctx_service.collect_context(recommendation_session_id=123)

    assert context.recommendation_session_id == 123
    assert context.member_id == 1
    assert context.season_cd == "fall"
    assert context.tpo_cd == "daily"
    assert context.tpo_text is None
    assert context.tpo_input_type_cd == "preset"
    assert context.going_out_start_at.isoformat() == "2026-09-27T15:00:00+09:00"
    assert context.going_out_end_at.isoformat() == "2026-09-27T18:00:00+09:00"
    assert context.weather.temperature == 20.0
    assert context.birth_year is None
    assert context.temperature_sensitivity_cd is None
    assert context.gender_cd == "unisex"
    assert context.preferred_styles == []
    assert context.clothing == []
    assert common_mocks[0][:2] == (123, FAKE_WEATHER)


async def test_context_filled_with_setting_and_clothing(common_mocks, monkeypatch):
    setting = MemberSettingRow(
        member_setting_id=10,
        birth_year=2000,
        temperature_sensitivity_cd="cold_sensitive",
        gender_cd="female",
    )
    candidate = ClothingCandidate(
        clothing_id=5,
        category_cd="top",
        accessory_type_cd=None,
        item_name="니트",
        color_cd="beige",
        thickness_cd="medium",
        is_waterproof=False,
        origin_image_url="http://example.com/5.png",
        cutout_image_url=None,
        styles=["casual"],
        seasons=["fall"],
    )

    async def fake_get_member_setting(db, member_id):
        return setting

    async def fake_get_preferred_styles(db, member_setting_id):
        assert member_setting_id == 10
        return ["casual", "street"]

    async def fake_get_completed_clothing(db, member_id):
        return [candidate]

    monkeypatch.setattr(member_setting_repo, "get_member_setting", fake_get_member_setting)
    monkeypatch.setattr(member_setting_repo, "get_preferred_styles", fake_get_preferred_styles)
    monkeypatch.setattr(clothing_repo, "get_completed_clothing", fake_get_completed_clothing)

    context = await ctx_service.collect_context(recommendation_session_id=456)

    assert context.birth_year == 2000
    assert context.temperature_sensitivity_cd == "cold_sensitive"
    assert context.gender_cd == "female"
    assert context.preferred_styles == ["casual", "street"]
    assert context.clothing == [candidate]


def _freeze_clock(monkeypatch, start: datetime) -> type[datetime]:
    class Clock(datetime):
        current = start

        @classmethod
        def now(cls, tz=None):
            return cls.current

    monkeypatch.setattr(ctx_service, "datetime", Clock)
    return Clock


def _no_member_data(monkeypatch):
    async def fake_get_member_setting(db, member_id):
        return None

    async def fake_get_completed_clothing(db, member_id):
        return []

    monkeypatch.setattr(member_setting_repo, "get_member_setting", fake_get_member_setting)
    monkeypatch.setattr(clothing_repo, "get_completed_clothing", fake_get_completed_clothing)


async def test_snapshot_keeps_weather_time_even_when_call_crosses_the_hour(
    common_mocks, monkeypatch
):
    clock = _freeze_clock(monkeypatch, datetime(2026, 9, 27, 14, 59, 58, tzinfo=KST))

    async def slow_get_weather(sido_nm, sigungu_nm, going_out_start, going_out_end, now):
        clock.current = datetime(2026, 9, 27, 15, 0, 3, tzinfo=KST)
        return FAKE_WEATHER

    monkeypatch.setattr(ctx_service, "get_weather", slow_get_weather)
    _no_member_data(monkeypatch)

    await ctx_service.collect_context(recommendation_session_id=123)

    assert common_mocks[0][2] == datetime(2026, 9, 27, 5, 59, 58)


async def test_snapshot_time_drops_fraction_so_rounding_cannot_cross_the_hour(
    common_mocks, monkeypatch
):
    _freeze_clock(monkeypatch, datetime(2026, 9, 27, 14, 59, 59, 600000, tzinfo=KST))
    _no_member_data(monkeypatch)

    await ctx_service.collect_context(recommendation_session_id=123)

    assert common_mocks[0][2] == datetime(2026, 9, 27, 5, 59, 59)


@pytest.mark.parametrize(
    ("going_out_start_at", "now", "expected"),
    [
        pytest.param(
            datetime(2026, 9, 27, 6, 0),
            datetime(2026, 9, 27, 14, 10, tzinfo=KST),
            False,
            id="today",
        ),
        pytest.param(
            datetime(2026, 9, 28, 4, 30),
            datetime(2026, 9, 27, 14, 10, tzinfo=KST),
            True,
            id="tomorrow",
        ),
        pytest.param(
            datetime(2026, 9, 28, 4, 30),
            datetime(2026, 9, 28, 0, 0, 5, tzinfo=KST),
            False,
            id="weather-fetched-after-midnight",
        ),
    ],
)
async def test_going_out_tomorrow_compares_start_date_with_weather_time(
    common_mocks, monkeypatch, going_out_start_at, now, expected
):
    session = replace(
        FIXED_SESSION,
        going_out_start_at=going_out_start_at,
        going_out_end_at=going_out_start_at + timedelta(hours=3),
    )

    async def fake_get_session(db, recommendation_session_id):
        return session

    monkeypatch.setattr(session_repo, "get_session", fake_get_session)
    _freeze_clock(monkeypatch, now)
    _no_member_data(monkeypatch)

    context = await ctx_service.collect_context(recommendation_session_id=123)

    assert context.is_going_out_tomorrow is expected


def _hour(at: datetime) -> HourlyWeather:
    return HourlyWeather(
        at=at,
        temperature=15.0,
        feels_like_temperature=14.0,
        precipitation=0.0,
        wind_speed=1.0,
        weather_condition_cd="clear",
    )


@pytest.mark.parametrize(
    ("going_out_start_at", "hourly", "expected"),
    [
        pytest.param(
            datetime(2026, 9, 28, 4, 30),
            [_hour(datetime(2026, 9, 28, 13, 0, tzinfo=KST))],
            True,
            id="tomorrow-with-forecast-in-window",
        ),
        pytest.param(datetime(2026, 9, 28, 4, 30), [], False, id="tomorrow-without-forecast"),
        pytest.param(
            datetime(2026, 9, 28, 4, 30),
            [_hour(datetime(2026, 9, 28, 18, 0, tzinfo=KST))],
            False,
            id="tomorrow-with-forecast-outside-window",
        ),
        pytest.param(
            datetime(2026, 9, 27, 6, 0),
            [_hour(datetime(2026, 9, 27, 15, 0, tzinfo=KST))],
            False,
            id="today-with-forecast",
        ),
    ],
)
async def test_ignores_current_weather_only_when_tomorrow_forecast_covers_window(
    common_mocks, monkeypatch, going_out_start_at, hourly, expected
):
    session = replace(
        FIXED_SESSION,
        going_out_start_at=going_out_start_at,
        going_out_end_at=going_out_start_at + timedelta(hours=3),
    )
    weather = replace(FAKE_WEATHER, hourly=hourly)

    async def fake_get_session(db, recommendation_session_id):
        return session

    async def fake_get_weather(sido_nm, sigungu_nm, going_out_start, going_out_end, now):
        return weather

    monkeypatch.setattr(session_repo, "get_session", fake_get_session)
    monkeypatch.setattr(ctx_service, "get_weather", fake_get_weather)
    _freeze_clock(monkeypatch, datetime(2026, 9, 27, 14, 10, tzinfo=KST))
    _no_member_data(monkeypatch)

    context = await ctx_service.collect_context(recommendation_session_id=123)

    assert context.ignores_current_weather is expected
