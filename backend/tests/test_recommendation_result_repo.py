"""REC-17 추천 결과 조회 리포지토리 테스트."""

from datetime import datetime
from decimal import Decimal

from app.repositories import recommendation_result as result_repo


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


def _session_row(**overrides):
    fields = dict(
        member_id=1,
        generation_status_cd="completed",
        session_status_cd="active",
        is_clothing_shortage=1,
        tpo_cd="daily",
        tpo_text=None,
        season_cd="fall",
        going_out_start_at=datetime(2026, 10, 9, 1, 0),
        going_out_end_at=datetime(2026, 10, 9, 9, 0),
        temperature=Decimal("17.0"),
        feels_like_temperature=Decimal("16.1"),
        weather_condition_cd="rain",
        is_weather_fallback=0,
        weather_session_id=7,
    )
    return _Row(**{**fields, **overrides})


async def test_get_session_converts_flags_to_bool():
    db = _FakeDb(_Result([_session_row()]))

    row = await result_repo.get_session(db, 7)

    assert row.is_clothing_shortage is True
    assert row.is_weather_fallback is False
    assert row.has_weather is True
    assert db.executed[0][1] == {"recommendation_session_id": 7}


async def test_get_session_keeps_missing_weather_as_none():
    db = _FakeDb(
        _Result([_session_row(is_weather_fallback=None, temperature=None, weather_session_id=None)])
    )

    row = await result_repo.get_session(db, 7)

    assert row.has_weather is False
    assert row.is_weather_fallback is None


async def test_get_session_returns_none_when_missing():
    db = _FakeDb(_Result([]))

    assert await result_repo.get_session(db, 7) is None


async def test_get_clothing_styles_groups_by_clothing():
    db = _FakeDb(
        _Result(
            [
                _Row(clothing_id=1, style_cd="minimal"),
                _Row(clothing_id=1, style_cd="casual"),
                _Row(clothing_id=2, style_cd="street"),
            ]
        )
    )

    styles = await result_repo.get_clothing_styles(db, [1, 2])

    assert styles == {1: ["minimal", "casual"], 2: ["street"]}
    assert db.executed[0][1] == {"clothing_ids": [1, 2]}


async def test_get_clothing_styles_skips_query_without_ids():
    db = _FakeDb()

    assert await result_repo.get_clothing_styles(db, []) == {}
    assert db.executed == []


async def test_get_outfit_items_maps_every_column():
    db = _FakeDb(
        _Result(
            [
                _Row(
                    deck_seq=2,
                    outfit_id=31,
                    outfit_seq=3,
                    outfit_type_cd="exploratory",
                    reason="이유",
                    outfit_item_id=41,
                    slot_cd="accessories",
                    item_source_cd="owned",
                    clothing_id=51,
                    item_name_snapshot="실버 시계",
                    image_url_snapshot="http://a/51.png",
                    accessory_type_cd="watch",
                    essential_style_cd=None,
                )
            ]
        )
    )

    rows = await result_repo.get_outfit_items(db, 7)

    assert rows == [
        result_repo.OutfitItemResultRow(
            deck_seq=2,
            outfit_id=31,
            outfit_seq=3,
            outfit_type_cd="exploratory",
            reason="이유",
            outfit_item_id=41,
            slot_cd="accessories",
            item_source_cd="owned",
            clothing_id=51,
            item_name_snapshot="실버 시계",
            image_url_snapshot="http://a/51.png",
            accessory_type_cd="watch",
            essential_style_cd=None,
        )
    ]
    assert db.executed[0][1] == {"recommendation_session_id": 7}
