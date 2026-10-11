"""REC-17 추천 결과 조회 서비스 테스트. 리포지토리는 가짜로 바꿔 끼운다."""

from datetime import datetime
from decimal import Decimal

import pytest

from app.repositories.recommendation_result import OutfitItemResultRow, ResultSessionRow
from app.services import recommendation_result as service

MEMBER_ID = 1


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
        item_name_snapshot=f"item-{outfit_item_id}",
        image_url_snapshot=None,
        accessory_type_cd=None,
        essential_style_cd=None,
    )
    return OutfitItemResultRow(**{**fields, **overrides})


@pytest.fixture
def fake_repo(monkeypatch):
    state = {"session": _session(), "rows": [], "styles": {}, "style_calls": []}

    async def get_session(db, recommendation_session_id):
        return state["session"]

    async def get_outfit_items(db, recommendation_session_id):
        return state["rows"]

    async def get_clothing_styles(db, clothing_ids):
        state["style_calls"].append(list(clothing_ids))
        return state["styles"]

    monkeypatch.setattr(service.result_repo, "get_session", get_session)
    monkeypatch.setattr(service.result_repo, "get_outfit_items", get_outfit_items)
    monkeypatch.setattr(service.result_repo, "get_clothing_styles", get_clothing_styles)
    return state


class _Storage:
    def url(self, key: str) -> str:
        return f"/media/{key}"


async def _get(member_id: int = MEMBER_ID):
    return await service.get_recommendation_result(object(), _Storage(), 7, member_id)


# ---------- 세션 ----------


async def test_missing_session_is_not_found(fake_repo):
    fake_repo["session"] = None

    with pytest.raises(service.RecommendationSessionNotFoundError):
        await _get()


async def test_other_members_session_is_not_found(fake_repo):
    with pytest.raises(service.RecommendationSessionNotFoundError):
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
    assert fake_repo["style_calls"] == [[1, 3]]


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
