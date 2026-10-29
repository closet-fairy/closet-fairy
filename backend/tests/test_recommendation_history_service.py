"""#173·#174 추천 내역 목록·상세 서비스 테스트. 리포지토리는 가짜로 바꿔 끼운다."""

from dataclasses import asdict
from datetime import datetime
from decimal import Decimal

import pytest

from app.repositories.recommendation_history import (
    HistoryDetailRow,
    HistorySessionRow,
    HistoryThumbnailRow,
)
from app.repositories.recommendation_result import OutfitItemResultRow
from app.services import recommendation_history as service
from app.services.prompt.outfit_generation import CATEGORY_ORDER
from app.services.session_errors import SessionNotFoundError
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


DETAIL_SESSION_ID = 41


def _detail(**overrides) -> HistoryDetailRow:
    fields = dict(
        asdict(_session(DETAIL_SESSION_ID)),
        outfit_type_cd="exploratory",
        reason="비가 와서 방수 부츠를 골랐어요.",
        precipitation=Decimal("1.5"),
        wind_speed=Decimal("3.2"),
    )
    return HistoryDetailRow(**{**fields, **overrides})


def _outfit_item(outfit_id: int, outfit_item_id: int, slot_cd: str, **overrides):
    fields = dict(
        deck_seq=1,
        outfit_id=outfit_id,
        outfit_seq=1,
        outfit_type_cd="preferred",
        reason=None,
        outfit_item_id=outfit_item_id,
        slot_cd=slot_cd,
        item_source_cd="owned",
        clothing_id=outfit_item_id + 500,
        essential_item_id=None,
        item_name_snapshot=f"item-{outfit_item_id}",
        image_url_snapshot=f"clothing/1/{outfit_item_id}.webp",
        accessory_type_cd=None,
        essential_style_cd=None,
    )
    return OutfitItemResultRow(**{**fields, **overrides})


def _deleted(outfit_id: int, outfit_item_id: int, slot_cd: str, **overrides):
    return _outfit_item(outfit_id, outfit_item_id, slot_cd, clothing_id=None, **overrides)


def _essential(outfit_id: int, outfit_item_id: int, slot_cd: str, **overrides):
    fields = dict(
        item_source_cd="essential",
        clothing_id=None,
        essential_item_id=outfit_item_id + 900,
        image_url_snapshot=None,
        essential_style_cd="casual",
    )
    return _outfit_item(outfit_id, outfit_item_id, slot_cd, **{**fields, **overrides})


@pytest.fixture
def fake_detail(monkeypatch):
    state = {
        "row": _detail(),
        "items": [],
        "styles": {},
        "detail_calls": [],
        "item_calls": [],
        "style_calls": [],
    }

    async def get_history_detail(db, member_id, recommendation_session_id):
        state["detail_calls"].append((member_id, recommendation_session_id))
        return state["row"]

    async def get_outfit_items(db, recommendation_session_id):
        state["item_calls"].append(recommendation_session_id)
        return state["items"]

    async def get_clothing_styles(db, clothing_ids):
        state["style_calls"].append(list(clothing_ids))
        return state["styles"]

    monkeypatch.setattr(service.history_repo, "get_history_detail", get_history_detail)
    monkeypatch.setattr(service.result_repo, "get_outfit_items", get_outfit_items)
    monkeypatch.setattr(service.result_repo, "get_clothing_styles", get_clothing_styles)
    return state


async def _get_detail():
    return await service.get_history_detail(object(), _Storage(), MEMBER_ID, DETAIL_SESSION_ID)


async def test_detail_raises_not_found_without_reading_items(fake_detail):
    fake_detail["row"] = None

    with pytest.raises(SessionNotFoundError):
        await _get_detail()

    assert fake_detail["detail_calls"] == [(MEMBER_ID, DETAIL_SESSION_ID)]
    assert fake_detail["item_calls"] == []
    assert fake_detail["style_calls"] == []


async def test_detail_keeps_only_rated_outfit_items_in_slot_order(fake_detail):
    rated = fake_detail["row"].rated_outfit_id
    other = rated + 1
    fake_detail["items"] = [
        _outfit_item(other, 1, "outer"),
        _outfit_item(rated, 2, "shoes"),
        _outfit_item(rated, 3, "accessories"),
        _outfit_item(other, 4, "top"),
        _outfit_item(rated, 6, "top"),
        _outfit_item(rated, 5, "top"),
        _outfit_item(rated, 7, "bottom"),
    ]

    detail = await _get_detail()

    expected = sorted(
        (r for r in fake_detail["items"] if r.outfit_id == rated),
        key=lambda r: (CATEGORY_ORDER.index(r.slot_cd), r.outfit_item_id),
    )
    assert [i.item_name for i in detail.outfit.items] == [r.item_name_snapshot for r in expected]
    slots = ["top", "top", "bottom", "shoes", "accessories"]
    assert [i.slot_cd for i in detail.outfit.items] == slots
    assert fake_detail["item_calls"] == [DETAIL_SESSION_ID]


async def test_only_owned_items_without_clothing_are_marked_deleted(fake_detail):
    rated = fake_detail["row"].rated_outfit_id
    fake_detail["items"] = [
        _outfit_item(rated, 1, "top"),
        _deleted(rated, 2, "bottom"),
        _essential(rated, 3, "shoes"),
    ]

    detail = await _get_detail()

    assert {i.slot_cd: i.is_clothing_deleted for i in detail.outfit.items} == {
        "top": False,
        "bottom": True,
        "shoes": False,
    }


async def test_styles_are_read_for_rated_owned_clothing_only(fake_detail):
    rated = fake_detail["row"].rated_outfit_id
    kept = _outfit_item(rated, 1, "top")
    essential = _essential(rated, 3, "shoes")
    fake_detail["items"] = [
        kept,
        _deleted(rated, 2, "bottom"),
        essential,
        _outfit_item(rated + 1, 4, "outer"),
    ]
    fake_detail["styles"] = {kept.clothing_id: ["minimal", "classic"]}

    detail = await _get_detail()

    assert fake_detail["style_calls"] == [[kept.clothing_id]]
    assert {i.slot_cd: i.style_cds for i in detail.outfit.items} == {
        "top": fake_detail["styles"][kept.clothing_id],
        "bottom": [],
        "shoes": [essential.essential_style_cd],
    }


async def test_deleted_clothing_keeps_snapshot_name_and_image(fake_detail):
    rated = fake_detail["row"].rated_outfit_id
    deleted = _deleted(rated, 2, "accessories", accessory_type_cd=None)
    bag = _outfit_item(rated, 3, "accessories", accessory_type_cd="bag")
    essential = _essential(rated, 1, "shoes")
    fake_detail["items"] = [deleted, bag, essential]

    detail = await _get_detail()

    assert [(i.item_name, i.image_url, i.accessory_type_cd) for i in detail.outfit.items] == [
        (essential.item_name_snapshot, None, None),
        (
            deleted.item_name_snapshot,
            _Storage().url(deleted.image_url_snapshot),
            None,
        ),
        (bag.item_name_snapshot, _Storage().url(bag.image_url_snapshot), bag.accessory_type_cd),
    ]
    assert [i.item_source_cd for i in detail.outfit.items] == ["essential", "owned", "owned"]


async def test_detail_weather_adds_precipitation_and_wind_speed(fake_detail):
    row = _detail(is_weather_fallback=True)
    fake_detail["row"] = row

    detail = await _get_detail()

    assert detail.weather.model_dump() == {
        "temperature": float(row.temperature),
        "feels_like_temperature": float(row.feels_like_temperature),
        "weather_condition_cd": row.weather_condition_cd,
        "is_fallback": True,
        "precipitation": float(row.precipitation),
        "wind_speed": float(row.wind_speed),
    }


async def test_detail_weather_is_null_without_snapshot(fake_detail):
    fake_detail["row"] = _detail(
        temperature=None,
        feels_like_temperature=None,
        precipitation=None,
        wind_speed=None,
        weather_condition_cd=None,
        is_weather_fallback=None,
        has_weather=False,
    )

    detail = await _get_detail()

    assert detail.weather is None


async def test_detail_keeps_session_and_outfit_values(fake_detail):
    row = _detail(tpo_cd="custom", tpo_text="친구 결혼식", rating=5)
    fake_detail["row"] = row

    detail = await _get_detail()

    def kst(utc: datetime) -> datetime:
        return utc.replace(tzinfo=KST) + KST.utcoffset(None)

    assert detail.recommendation_session_id == row.recommendation_session_id
    assert detail.recommended_at == kst(row.created_at)
    assert detail.condition.going_out_start_at == kst(row.going_out_start_at)
    assert detail.condition.going_out_end_at == kst(row.going_out_end_at)
    assert (detail.condition.sido_nm, detail.condition.sigungu_nm) == (row.sido_nm, row.sigungu_nm)
    assert (detail.condition.tpo_cd, detail.condition.tpo_text) == (row.tpo_cd, row.tpo_text)
    assert detail.rating == row.rating
    assert (detail.outfit.outfit_type_cd, detail.outfit.reason) == (row.outfit_type_cd, row.reason)
