"""weather_snapshot 리포지토리 테스트."""

from datetime import datetime
from decimal import Decimal

from app.repositories import weather_snapshot as weather_snapshot_repo
from app.services.weather.weather_service import WeatherResult


class _Row:
    def __init__(self, **kwargs):
        self.__dict__.update(kwargs)


class _Result:
    def __init__(self, rows):
        self._rows = rows

    def first(self):
        return self._rows[0] if self._rows else None


class _FakeDb:
    def __init__(self, rows):
        self.executed = []
        self._rows = rows

    async def execute(self, statement, params):
        self.executed.append((str(statement), params))
        return _Result(self._rows)

    async def commit(self):
        pass


def _row(**overrides):
    fields = dict(
        temperature=Decimal("17.5"),
        feels_like_temperature=Decimal("16.2"),
        precipitation=Decimal("0.0"),
        wind_speed=Decimal("2.1"),
        weather_condition_cd="clear",
        hourly_forecast='[{"at": "2026-10-16T09:00:00+09:00", "temperature": 16.0}]',
        is_fallback=0,
        created_at=datetime(2026, 10, 16, 0, 1, 2),
    )
    return _Row(**{**fields, **overrides})


async def test_get_weather_snapshot_parses_hourly_json():
    db = _FakeDb([_row()])

    row = await weather_snapshot_repo.get_weather_snapshot(db, 7)

    sql, params = db.executed[0]
    assert "FROM weather_snapshot" in sql
    assert params == {"recommendation_session_id": 7}
    assert row.hourly_forecast == [{"at": "2026-10-16T09:00:00+09:00", "temperature": 16.0}]
    assert row.is_fallback is False
    assert row.feels_like_temperature == Decimal("16.2")
    assert row.created_at == datetime(2026, 10, 16, 0, 1, 2)


async def test_get_weather_snapshot_treats_null_hourly_as_empty():
    row = await weather_snapshot_repo.get_weather_snapshot(_FakeDb([_row(hourly_forecast=None)]), 7)

    assert row.hourly_forecast == []


async def test_get_weather_snapshot_returns_none_when_missing():
    assert await weather_snapshot_repo.get_weather_snapshot(_FakeDb([]), 7) is None


async def test_insert_weather_snapshot_stores_given_created_at():
    db = _FakeDb([])
    weather = WeatherResult(
        temperature=17.5,
        feels_like_temperature=16.2,
        precipitation=0.0,
        wind_speed=2.1,
        weather_condition_cd="clear",
        min_feels_like_temperature=15.0,
    )

    await weather_snapshot_repo.insert_weather_snapshot(
        db, 7, weather, datetime(2026, 10, 16, 5, 59, 58)
    )

    sql, params = db.executed[0]
    assert ":created_at" in sql
    assert params["created_at"] == datetime(2026, 10, 16, 5, 59, 58)
