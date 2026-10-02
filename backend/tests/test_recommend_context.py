from datetime import datetime

import pytest

from app.repositories import clothing as clothing_repo
from app.repositories import member_setting as member_setting_repo
from app.repositories import recommendation_session as session_repo
from app.repositories import weather_snapshot as weather_snapshot_repo
from app.repositories.clothing import ClothingCandidate
from app.repositories.member_setting import MemberSettingRow
from app.repositories.recommendation_session import SessionRow
from app.services import recommend_context as ctx_service
from app.services.weather.weather_service import WeatherResult

FIXED_SESSION = SessionRow(
    member_id=1,
    sido_nm="서울특별시",
    sigungu_nm="성동구",
    going_out_start_at=datetime(2026, 9, 27, 6, 0),  # UTC naive, KST 15:00
    going_out_end_at=datetime(2026, 9, 27, 9, 0),  # UTC naive, KST 18:00
    season_cd="fall",
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

    async def fake_insert_weather_snapshot(db, recommendation_session_id, weather):
        saved_snapshots.append((recommendation_session_id, weather))

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
    assert context.going_out_start_at.isoformat() == "2026-09-27T15:00:00+09:00"
    assert context.going_out_end_at.isoformat() == "2026-09-27T18:00:00+09:00"
    assert context.weather.temperature == 20.0
    assert context.birth_year is None
    assert context.temperature_sensitivity_cd is None
    assert context.gender_cd == "unisex"
    assert context.preferred_styles == []
    assert context.clothing == []
    assert common_mocks[0] == (123, FAKE_WEATHER)


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
