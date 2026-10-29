"""#173·#174 추천 내역 목록·상세 리포지토리 테스트."""

from datetime import datetime
from decimal import Decimal

from app.repositories import recommendation_history as history_repo


class _Row:
    def __init__(self, **kwargs):
        self.__dict__.update(kwargs)


class _Result:
    def __init__(self, rows):
        self._rows = rows

    def all(self):
        return self._rows

    def first(self):
        return self._rows[0] if self._rows else None


class _FakeDb:
    def __init__(self, *results):
        self._results = list(results)
        self.executed = []

    async def execute(self, statement, params):
        self.executed.append((str(statement), params))
        return self._results.pop(0)


SESSION_FIELDS = dict(
    recommendation_session_id=41,
    created_at=datetime(2026, 10, 26, 22, 42, 10),
    tpo_cd="custom",
    tpo_text="친구 결혼식",
    season_cd="fall",
    sido_nm="세종특별자치시",
    sigungu_nm="세종특별자치시",
    going_out_start_at=datetime(2026, 10, 26, 23, 30),
    going_out_end_at=datetime(2026, 10, 27, 10, 0),
    rated_outfit_id=105,
    rating=4,
    temperature=Decimal("11.4"),
    feels_like_temperature=Decimal("9.8"),
    weather_condition_cd="clear",
)


def _session_row(**overrides):
    fields = dict(SESSION_FIELDS, is_weather_fallback=1, weather_session_id=41)
    return _Row(**{**fields, **overrides})


async def test_get_history_page_maps_every_column():
    params = {"member_id": 7, "cursor": 50, "limit": 21}
    db = _FakeDb(_Result([_session_row()]))

    rows = await history_repo.get_history_page(db, **params)

    assert rows == [
        history_repo.HistorySessionRow(**SESSION_FIELDS, is_weather_fallback=True, has_weather=True)
    ]
    assert rows[0].is_weather_fallback is True
    assert db.executed[0][1] == params


async def test_get_history_page_keeps_missing_weather_as_none():
    db = _FakeDb(
        _Result(
            [
                _session_row(
                    temperature=None,
                    feels_like_temperature=None,
                    weather_condition_cd=None,
                    is_weather_fallback=None,
                    weather_session_id=None,
                )
            ]
        )
    )

    [row] = await history_repo.get_history_page(db, 7, None, 21)

    assert row.has_weather is False
    assert row.is_weather_fallback is None


async def test_history_page_sql_filters_own_rated_completed_sessions_by_id():
    db = _FakeDb(_Result([]))

    await history_repo.get_history_page(db, 7, None, 21)

    sql = db.executed[0][0]
    assert "f.feedback_type_cd = 'rated'" in sql
    assert "s.session_status_cd = 'completed'" in sql
    assert "s.member_id = :member_id" in sql
    assert "s.recommendation_session_id < :cursor" in sql
    assert "ORDER BY s.recommendation_session_id DESC" in sql


DETAIL_FIELDS = dict(
    SESSION_FIELDS,
    outfit_type_cd="exploratory",
    reason="비가 와서 방수 부츠를 골랐어요.",
    precipitation=Decimal("1.5"),
    wind_speed=Decimal("3.2"),
)


async def test_get_history_detail_maps_every_column():
    session_id = SESSION_FIELDS["recommendation_session_id"]
    params = {"member_id": 7, "recommendation_session_id": session_id}
    db = _FakeDb(
        _Result([_Row(**DETAIL_FIELDS, is_weather_fallback=0, weather_session_id=session_id)])
    )

    row = await history_repo.get_history_detail(db, **params)

    assert row == history_repo.HistoryDetailRow(
        **DETAIL_FIELDS, is_weather_fallback=False, has_weather=True
    )
    assert row.is_weather_fallback is False
    assert db.executed[0][1] == params


async def test_get_history_detail_returns_none_without_row():
    db = _FakeDb(_Result([]))

    assert await history_repo.get_history_detail(db, 7, 41) is None


async def test_get_history_detail_keeps_missing_weather_as_none():
    fields = dict(
        DETAIL_FIELDS,
        temperature=None,
        feels_like_temperature=None,
        precipitation=None,
        wind_speed=None,
        weather_condition_cd=None,
        is_weather_fallback=None,
        weather_session_id=None,
    )
    db = _FakeDb(_Result([_Row(**fields)]))

    row = await history_repo.get_history_detail(db, 7, 41)

    assert row.has_weather is False
    assert (row.is_weather_fallback, row.precipitation, row.wind_speed) == (None, None, None)


async def test_history_detail_sql_filters_own_rated_completed_session():
    db = _FakeDb(_Result([]))

    await history_repo.get_history_detail(db, 7, 41)

    sql = db.executed[0][0]
    assert "s.recommendation_session_id = :recommendation_session_id" in sql
    assert "s.member_id = :member_id" in sql
    assert "s.session_status_cd = 'completed'" in sql
    assert "f.feedback_type_cd = 'rated'" in sql
    assert "JOIN outfit o ON o.outfit_id = f.outfit_id" in sql


async def test_get_thumbnails_maps_every_column():
    fields = dict(
        outfit_id=105,
        outfit_item_id=301,
        slot_cd="shoes",
        item_name_snapshot="블랙 로퍼",
        image_url_snapshot=None,
    )
    db = _FakeDb(_Result([_Row(**fields)]))

    rows = await history_repo.get_thumbnails(db, [105, 98])

    assert rows == [history_repo.HistoryThumbnailRow(**fields)]
    assert db.executed[0][1] == {"outfit_ids": [105, 98]}


async def test_get_thumbnails_skips_query_without_ids():
    db = _FakeDb()

    assert await history_repo.get_thumbnails(db, []) == []
    assert db.executed == []
