"""#173 추천 내역 목록 서비스 테스트. 리포지토리는 가짜로 바꿔 끼운다."""

from datetime import datetime
from decimal import Decimal

import pytest

from app.repositories.recommendation_history import HistorySessionRow, HistoryThumbnailRow
from app.services import recommendation_history as service
from app.services.prompt.outfit_generation import CATEGORY_ORDER
from app.services.weather.base_time import KST

MEMBER_ID = 1
CREATED_AT = datetime(2026, 10, 26, 22, 42, 10)
START_AT = datetime(2026, 10, 26, 23, 30)
END_AT = datetime(2026, 10, 27, 10, 0)


def _session(session_id: int, **overrides) -> HistorySessionRow:
    fields = dict(
        recommendation_session_id=session_id,
        created_at=CREATED_AT,
        tpo_cd="work",
        tpo_text=None,
        season_cd="fall",
        sido_nm="세종특별자치시",
        sigungu_nm="조치원읍",
        going_out_start_at=START_AT,
        going_out_end_at=END_AT,
        rated_outfit_id=session_id * 10,
        rating=4,
        temperature=Decimal("11.4"),
        feels_like_temperature=Decimal("9.8"),
        weather_condition_cd="clear",
        is_weather_fallback=False,
        has_weather=True,
    )
    return HistorySessionRow(**{**fields, **overrides})


def _thumbnail(outfit_id: int, outfit_item_id: int, slot_cd: str, **overrides):
    fields = dict(
        outfit_id=outfit_id,
        outfit_item_id=outfit_item_id,
        slot_cd=slot_cd,
        item_name_snapshot=f"item-{outfit_item_id}",
        image_url_snapshot=f"clothing/1/{outfit_item_id}.webp",
    )
    return HistoryThumbnailRow(**{**fields, **overrides})


@pytest.fixture
def fake_repo(monkeypatch):
    state = {"rows": [], "thumbnails": [], "page_calls": [], "thumbnail_calls": []}

    async def get_history_page(db, member_id, cursor, limit):
        state["page_calls"].append((member_id, cursor, limit))
        return state["rows"]

    async def get_thumbnails(db, outfit_ids):
        state["thumbnail_calls"].append(list(outfit_ids))
        return state["thumbnails"]

    monkeypatch.setattr(service.history_repo, "get_history_page", get_history_page)
    monkeypatch.setattr(service.history_repo, "get_thumbnails", get_thumbnails)
    return state


class _Storage:
    def url(self, key: str) -> str:
        return f"/media/{key}"


async def _get(cursor: int | None = None, limit: int = 2):
    return await service.get_history_page(object(), _Storage(), MEMBER_ID, cursor, limit)


async def test_reads_one_more_row_and_trims_it_into_next_cursor(fake_repo):
    limit, cursor = 2, 10
    rows = [_session(9), _session(7), _session(4)]
    fake_repo["rows"] = rows

    page = await _get(cursor=cursor, limit=limit)

    assert fake_repo["page_calls"] == [(MEMBER_ID, cursor, limit + 1)]
    assert [i.recommendation_session_id for i in page.items] == [
        r.recommendation_session_id for r in rows[:limit]
    ]
    assert page.next_cursor == page.items[-1].recommendation_session_id


async def test_exactly_limit_rows_is_the_last_page(fake_repo):
    rows = [_session(9), _session(7)]
    fake_repo["rows"] = rows

    page = await _get(limit=len(rows))

    assert len(page.items) == len(rows)
    assert page.next_cursor is None


async def test_thumbnails_are_read_only_for_rated_outfits_on_the_page(fake_repo):
    rows = [_session(9), _session(7), _session(4)]
    fake_repo["rows"] = rows

    await _get(limit=2)

    assert fake_repo["thumbnail_calls"] == [[r.rated_outfit_id for r in rows[:2]]]


async def test_thumbnails_are_grouped_by_rated_outfit_in_slot_order(fake_repo):
    first, second = _session(9), _session(7)
    fake_repo["rows"] = [first, second]
    fake_repo["thumbnails"] = [
        _thumbnail(first.rated_outfit_id, 1, "shoes"),
        _thumbnail(first.rated_outfit_id, 2, "outer"),
        _thumbnail(first.rated_outfit_id, 4, "top"),
        _thumbnail(first.rated_outfit_id, 3, "top"),
        _thumbnail(second.rated_outfit_id, 5, "bottom"),
    ]

    page = await _get()

    expected_first = sorted(
        (t for t in fake_repo["thumbnails"] if t.outfit_id == first.rated_outfit_id),
        key=lambda t: (CATEGORY_ORDER.index(t.slot_cd), t.outfit_item_id),
    )
    assert [t.item_name for t in page.items[0].thumbnails] == [
        t.item_name_snapshot for t in expected_first
    ]
    assert [t.slot_cd for t in page.items[0].thumbnails] == ["outer", "top", "top", "shoes"]
    assert [t.item_name for t in page.items[1].thumbnails] == ["item-5"]


async def test_times_are_converted_to_kst(fake_repo):
    fake_repo["rows"] = [_session(9)]

    [item] = (await _get()).items

    def kst(utc: datetime) -> datetime:
        return utc.replace(tzinfo=KST) + KST.utcoffset(None)

    assert item.recommended_at == kst(CREATED_AT)
    assert item.recommended_at.utcoffset() == KST.utcoffset(None)
    assert item.condition.going_out_start_at == kst(START_AT)
    assert item.condition.going_out_end_at == kst(END_AT)


async def test_weather_is_null_without_snapshot(fake_repo):
    fake_repo["rows"] = [
        _session(
            9,
            temperature=None,
            feels_like_temperature=None,
            weather_condition_cd=None,
            is_weather_fallback=None,
            has_weather=False,
        )
    ]

    [item] = (await _get()).items

    assert item.weather is None


async def test_weather_values_are_converted(fake_repo):
    row = _session(9, is_weather_fallback=True)
    fake_repo["rows"] = [row]

    [item] = (await _get()).items

    assert item.weather.model_dump() == {
        "temperature": float(row.temperature),
        "feels_like_temperature": float(row.feels_like_temperature),
        "weather_condition_cd": row.weather_condition_cd,
        "is_fallback": True,
    }


async def test_image_keys_become_urls_and_missing_images_stay_null(fake_repo):
    row = _session(9)
    fake_repo["rows"] = [row]
    with_image = _thumbnail(row.rated_outfit_id, 1, "top")
    fake_repo["thumbnails"] = [
        with_image,
        _thumbnail(row.rated_outfit_id, 2, "shoes", image_url_snapshot=None),
    ]

    [item] = (await _get()).items

    assert [t.image_url for t in item.thumbnails] == [
        _Storage().url(with_image.image_url_snapshot),
        None,
    ]


async def test_condition_keeps_stored_values(fake_repo):
    row = _session(9, tpo_cd="custom", tpo_text="친구 결혼식", rating=5)
    fake_repo["rows"] = [row]

    [item] = (await _get()).items

    assert (item.condition.sido_nm, item.condition.sigungu_nm) == (row.sido_nm, row.sigungu_nm)
    assert (item.condition.tpo_cd, item.condition.tpo_text) == (row.tpo_cd, row.tpo_text)
    assert item.rating == row.rating


async def test_empty_history(fake_repo):
    page = await _get()

    assert page.items == []
    assert page.next_cursor is None
