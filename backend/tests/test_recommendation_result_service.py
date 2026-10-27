"""REC-17 추천 결과 조회 서비스 테스트. 리포지토리는 가짜로 바꿔 끼운다."""

from datetime import datetime, timedelta
from decimal import Decimal

import pytest

from app.core.config import get_settings
from app.repositories.recommendation_result import OutfitItemResultRow, ResultSessionRow
from app.repositories.regeneration_request import LatestRequestRow
from app.services import recommendation_result as service
from app.services.recommendation_session import to_db_utc
from app.services.session_errors import SessionNotFoundError
from app.services.weather.base_time import KST

MEMBER_ID = 1
NOW = datetime(2026, 10, 14, 21, 30, tzinfo=KST)
STALE_BEFORE = to_db_utc(NOW) - timedelta(
    seconds=get_settings().REGENERATION_PROCESSING_TIMEOUT_SECONDS
)


def _session(**overrides) -> ResultSessionRow:
    fields = dict(
        member_id=MEMBER_ID,
        generation_status_cd="completed",
        session_status_cd="active",
        is_clothing_shortage=False,
        tpo_cd="work",
        tpo_text=None,
        season_cd="fall",
        going_out_start_at=datetime(2026, 10, 9, 23, 0),
        going_out_end_at=datetime(2026, 10, 10, 10, 0),
        temperature=Decimal("14.2"),
        feels_like_temperature=Decimal("12.8"),
        weather_condition_cd="cloudy",
        is_weather_fallback=False,
        has_weather=True,
    )
    return ResultSessionRow(**{**fields, **overrides})


def _item(outfit_item_id: int, slot_cd: str, **overrides) -> OutfitItemResultRow:
    fields = dict(
        deck_seq=1,
        outfit_id=100,
        outfit_seq=1,
        outfit_type_cd="preferred",
        reason="이유",
        outfit_item_id=outfit_item_id,
        slot_cd=slot_cd,
        item_source_cd="owned",
        clothing_id=outfit_item_id,
        essential_item_id=None,
        item_name_snapshot=f"item-{outfit_item_id}",
        image_url_snapshot=None,
        accessory_type_cd=None,
        essential_style_cd=None,
    )
    return OutfitItemResultRow(**{**fields, **overrides})


def _request(**overrides) -> LatestRequestRow:
    fields = dict(
        request_seq=2,
        regeneration_status_cd="processing",
        target_scope_cd="single",
        target_outfit_id=102,
        target_slot_cd="shoes",
        created_at=STALE_BEFORE + timedelta(seconds=30),
    )
    return LatestRequestRow(**{**fields, **overrides})


@pytest.fixture
def fake_repo(monkeypatch):
    state = {
        "session": _session(),
        "rows": [],
        "styles": {},
        "style_calls": [],
        "latest_request": None,
        "request_calls": [],
    }

    async def get_session(db, recommendation_session_id):
        return state["session"]

    async def get_outfit_items(db, recommendation_session_id):
        return state["rows"]

    async def get_clothing_styles(db, clothing_ids):
        state["style_calls"].append(list(clothing_ids))
        return state["styles"]

    async def find_latest_request(db, recommendation_session_id):
        state["request_calls"].append(recommendation_session_id)
        return state["latest_request"]

    monkeypatch.setattr(service.result_repo, "get_session", get_session)
    monkeypatch.setattr(service.result_repo, "get_outfit_items", get_outfit_items)
    monkeypatch.setattr(service.result_repo, "get_clothing_styles", get_clothing_styles)
    monkeypatch.setattr(service.regeneration_repo, "find_latest_request", find_latest_request)
    return state


class _Storage:
    def url(self, key: str) -> str:
        return f"/media/{key}"


async def _get(member_id: int = MEMBER_ID):
    return await service.get_recommendation_result(object(), _Storage(), 7, member_id, NOW)


# ---------- 세션 ----------


async def test_missing_session_is_not_found(fake_repo):
    fake_repo["session"] = None

    with pytest.raises(SessionNotFoundError):
        await _get()


async def test_other_members_session_is_not_found(fake_repo):
    with pytest.raises(SessionNotFoundError):
        await _get(member_id=MEMBER_ID + 1)


async def test_condition_times_are_converted_to_kst(fake_repo):
    result = await _get()

    start = result.condition.going_out_start_at
    assert start.isoformat() == "2026-10-10T08:00:00+09:00"
    assert result.condition.going_out_end_at.isoformat() == "2026-10-10T19:00:00+09:00"


async def test_weather_is_null_before_snapshot(fake_repo):
    fake_repo["session"] = _session(
        temperature=None,
        feels_like_temperature=None,
        weather_condition_cd=None,
        is_weather_fallback=None,
        has_weather=False,
    )

    result = await _get()

    assert result.weather is None


async def test_weather_is_returned_with_fallback_flag(fake_repo):
    fake_repo["session"] = _session(is_weather_fallback=True)

    result = await _get()

    assert result.weather.temperature == 14.2
    assert result.weather.is_fallback is True


# ---------- 생성 상태 ----------


@pytest.mark.parametrize("status", ["processing", "failed"])
async def test_outfits_are_empty_unless_completed(fake_repo, status):
    fake_repo["session"] = _session(generation_status_cd=status)
    fake_repo["rows"] = [_item(1, "top")]

    result = await _get()

    assert result.generation_status_cd == status
    assert result.outfits == []
    assert fake_repo["style_calls"] == []


# ---------- 코디 조립 ----------


async def test_items_are_ordered_by_slot(fake_repo):
    fake_repo["rows"] = [
        _item(1, "accessories", accessory_type_cd="watch"),
        _item(2, "shoes"),
        _item(3, "top"),
        _item(4, "outer"),
        _item(5, "bottom"),
    ]

    result = await _get()

    assert [i.slot_cd for i in result.outfits[0].items] == [
        "outer",
        "top",
        "bottom",
        "shoes",
        "accessories",
    ]
    assert result.outfits[0].items[-1].accessory_type_cd == "watch"


async def test_styles_come_from_clothing_or_essential(fake_repo):
    fake_repo["rows"] = [
        _item(1, "top"),
        _item(
            2, "bottom", item_source_cd="essential", clothing_id=None, essential_style_cd="formal"
        ),
        _item(3, "shoes", clothing_id=None),
    ]
    fake_repo["styles"] = {1: ["minimal", "casual"]}

    result = await _get()

    assert [i.style_cds for i in result.outfits[0].items] == [
        ["minimal", "casual"],
        ["formal"],
        [],
    ]
    assert fake_repo["style_calls"] == [[1]]


async def test_latest_deck_wins_per_outfit_seq(fake_repo):
    fake_repo["rows"] = [
        _item(1, "top", deck_seq=1, outfit_id=101, outfit_seq=1),
        _item(2, "top", deck_seq=1, outfit_id=102, outfit_seq=2),
        _item(3, "top", deck_seq=2, outfit_id=201, outfit_seq=2, outfit_type_cd="exploratory"),
    ]

    result = await _get()

    assert [(o.outfit_seq, o.outfit_id, o.outfit_type_cd) for o in result.outfits] == [
        (1, 101, "preferred"),
        (2, 201, "exploratory"),
    ]
    assert [p.outfit_id for p in result.outfits[1].previous_outfits] == [102]


# ---------- 이전 코디 ----------


async def test_slot_regenerated_twice_keeps_previous_outfits_newest_first(fake_repo):
    fake_repo["rows"] = [
        *[
            _item(seq, "top", deck_seq=1, outfit_id=100 + seq, outfit_seq=seq)
            for seq in (1, 2, 3, 4)
        ],
        _item(5, "top", deck_seq=2, outfit_id=202, outfit_seq=2, reason="두 번째"),
        _item(6, "top", deck_seq=3, outfit_id=302, outfit_seq=2, reason="세 번째"),
    ]

    result = await _get()

    assert [(o.outfit_seq, o.outfit_id) for o in result.outfits] == [
        (1, 101),
        (2, 302),
        (3, 103),
        (4, 104),
    ]
    second = result.outfits[1]
    assert [(p.outfit_id, p.reason) for p in second.previous_outfits] == [
        (202, "두 번째"),
        (102, "이유"),
    ]
    assert [p.outfit_seq for p in second.previous_outfits] == [2, 2]
    assert [o.previous_outfits for o in result.outfits if o.outfit_seq != 2] == [[], [], []]


async def test_slot_left_out_of_partial_regeneration_keeps_earlier_outfit(fake_repo):
    fake_repo["rows"] = [
        *[
            _item(seq, "top", deck_seq=1, outfit_id=100 + seq, outfit_seq=seq)
            for seq in (1, 2, 3, 4)
        ],
        *[
            _item(10 + seq, "top", deck_seq=2, outfit_id=200 + seq, outfit_seq=seq)
            for seq in (1, 2, 3)
        ],
    ]

    result = await _get()

    assert [(o.outfit_seq, o.outfit_id) for o in result.outfits] == [
        (1, 201),
        (2, 202),
        (3, 203),
        (4, 104),
    ]
    assert [[p.outfit_id for p in o.previous_outfits] for o in result.outfits] == [
        [101],
        [102],
        [103],
        [],
    ]


async def test_slot_first_filled_by_later_deck_is_placed_by_outfit_seq(fake_repo):
    fake_repo["rows"] = [
        _item(1, "top", deck_seq=1, outfit_id=101, outfit_seq=1),
        _item(2, "top", deck_seq=1, outfit_id=102, outfit_seq=2),
        _item(4, "top", deck_seq=1, outfit_id=104, outfit_seq=4),
        _item(5, "top", deck_seq=2, outfit_id=203, outfit_seq=3),
    ]

    result = await _get()

    assert [(o.outfit_seq, o.outfit_id) for o in result.outfits] == [
        (1, 101),
        (2, 102),
        (3, 203),
        (4, 104),
    ]


async def test_previous_outfit_items_get_clothing_styles(fake_repo):
    fake_repo["rows"] = [
        _item(1, "top", deck_seq=1, outfit_id=101, clothing_id=11),
        _item(2, "top", deck_seq=2, outfit_id=201, clothing_id=21),
    ]
    fake_repo["styles"] = {11: ["casual"], 21: ["minimal"]}

    result = await _get()

    assert result.outfits[0].items[0].style_cds == ["minimal"]
    assert result.outfits[0].previous_outfits[0].items[0].style_cds == ["casual"]
    assert fake_repo["style_calls"] == [[11, 21]]


# ---------- 재추천 상태 ----------


async def test_latest_regeneration_is_null_without_request(fake_repo):
    result = await _get()

    assert result.latest_regeneration is None
    assert fake_repo["request_calls"] == [7]


@pytest.mark.parametrize("status", ["processing", "completed", "failed"])
async def test_latest_regeneration_returns_request_as_is(fake_repo, status):
    fake_repo["latest_request"] = _request(regeneration_status_cd=status)

    result = await _get()

    assert result.latest_regeneration.model_dump() == {
        "request_seq": 2,
        "regeneration_status_cd": status,
        "target_scope_cd": "single",
        "target_outfit_id": 102,
        "target_slot_cd": "shoes",
    }


async def test_latest_regeneration_for_all_has_no_target(fake_repo):
    fake_repo["latest_request"] = _request(
        target_scope_cd="all", target_outfit_id=None, target_slot_cd=None
    )

    result = await _get()

    assert result.latest_regeneration.target_scope_cd == "all"
    assert result.latest_regeneration.target_outfit_id is None
    assert result.latest_regeneration.target_slot_cd is None


@pytest.mark.parametrize(
    ("created_at", "expected"),
    [
        (STALE_BEFORE, "processing"),
        (STALE_BEFORE - timedelta(seconds=1), "failed"),
    ],
)
async def test_timed_out_processing_is_shown_as_failed_without_writing(
    fake_repo, monkeypatch, created_at, expected
):
    fake_repo["latest_request"] = _request(created_at=created_at)
    writes = []
    for name in ("fail_stale_processing", "fail_request", "complete_request"):
        monkeypatch.setattr(
            service.regeneration_repo, name, lambda *args, _name=name: writes.append(_name)
        )

    result = await _get()

    assert result.latest_regeneration.regeneration_status_cd == expected
    assert fake_repo["latest_request"].regeneration_status_cd == "processing"
    assert writes == []


@pytest.mark.parametrize("status", ["completed", "failed"])
async def test_finished_request_is_not_affected_by_timeout(fake_repo, status):
    fake_repo["latest_request"] = _request(
        regeneration_status_cd=status, created_at=STALE_BEFORE - timedelta(hours=1)
    )

    result = await _get()

    assert result.latest_regeneration.regeneration_status_cd == status


@pytest.mark.parametrize("session_status", ["completed", "canceled", "abandoned"])
async def test_latest_regeneration_is_null_for_ended_session(fake_repo, session_status):
    fake_repo["session"] = _session(session_status_cd=session_status)
    fake_repo["latest_request"] = _request()

    result = await _get()

    assert result.latest_regeneration is None
    assert fake_repo["request_calls"] == []


@pytest.mark.parametrize("generation_status", ["processing", "failed"])
async def test_latest_regeneration_is_null_until_first_recommendation_completes(
    fake_repo, generation_status
):
    fake_repo["session"] = _session(generation_status_cd=generation_status)
    fake_repo["latest_request"] = _request()

    result = await _get()

    assert result.latest_regeneration is None
    assert fake_repo["request_calls"] == []


async def test_snapshot_name_and_image_url_are_used(fake_repo):
    fake_repo["rows"] = [
        _item(1, "top", item_name_snapshot="네이비 니트", image_url_snapshot="clothing/7/a.webp"),
        _item(2, "bottom", item_name_snapshot="블랙 슬랙스", image_url_snapshot=None),
    ]

    result = await _get()

    items = result.outfits[0].items
    assert [(i.item_name, i.image_url) for i in items] == [
        ("네이비 니트", "/media/clothing/7/a.webp"),
        ("블랙 슬랙스", None),
    ]
