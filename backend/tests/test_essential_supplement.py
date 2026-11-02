"""REC-09 에센셜 보충(supplement_essentials) 단위 테스트."""

from types import SimpleNamespace
from typing import get_args

import pytest

from app.core.config import get_settings
from app.repositories import essential_item as essential_item_repo
from app.repositories.clothing import ClothingCandidate
from app.repositories.essential_item import EssentialItemCandidate
from app.schemas.recommendation_session import TpoCd
from app.services.essential_supplement import (
    DEFAULT_FORMALITY_RANGE,
    FORMALITY_RANGE_BY_TPO,
    _fetch_essential_items,
    formality_range_for_tpo,
    supplement_essentials,
)
from app.services.prompt.outfit_generation import candidate_key
from app.services.rule_filter import FilterResult


def _owned(
    clothing_id: int,
    category_cd: str | None,
    styles: list[str] | None = None,
    thickness_cd: str = "medium",
    is_waterproof: bool = False,
    accessory_type_cd: str | None = None,
) -> ClothingCandidate:
    return ClothingCandidate(
        clothing_id=clothing_id,
        category_cd=category_cd,
        accessory_type_cd=accessory_type_cd,
        item_name=f"owned-{clothing_id}",
        color_cd="black",
        thickness_cd=thickness_cd,
        is_waterproof=is_waterproof,
        origin_image_url="http://example.com/img.png",
        cutout_image_url=None,
        styles=styles or [],
        seasons=[],
    )


def _essential(
    essential_item_id: int,
    category_cd: str,
    style_cd: str = "casual",
    thickness_cd: str | None = "medium",
    is_waterproof: bool = False,
) -> EssentialItemCandidate:
    return EssentialItemCandidate(
        essential_item_id=essential_item_id,
        item_name=f"essential-{essential_item_id}",
        category_cd=category_cd,
        accessory_type_cd=None,
        style_cd=style_cd,
        color_cd="black",
        thickness_cd=thickness_cd,
        is_waterproof=is_waterproof,
        formality_level=1,
        gender_cd="unisex",
    )


def _filter_result(
    candidates: list[ClothingCandidate], outer_requirement="optional", precipitation_expected=False
) -> FilterResult:
    return FilterResult(
        candidates=candidates,
        outer_requirement=outer_requirement,
        precipitation_expected=precipitation_expected,
    )


def _full_basics() -> list[ClothingCandidate]:
    """상의·하의·신발이 2벌씩 있어 부족이 없는 기본 옷장."""
    return [
        _owned(1, "top"),
        _owned(2, "top"),
        _owned(3, "bottom"),
        _owned(4, "bottom"),
        _owned(5, "shoes"),
        _owned(6, "shoes"),
    ]


def test_no_shortage_when_each_category_has_two_items():
    result = supplement_essentials(
        _filter_result(_full_basics()), [], {}, min_feels_like_temperature=15.0
    )

    assert result.is_clothing_shortage is False
    assert len(result.candidates) == 6
    assert all(c.source_cd == "owned" for c in result.candidates)


def test_only_shoes_shortage_supplements_only_shoes():
    owned = [
        _owned(1, "top"),
        _owned(2, "top"),
        _owned(3, "bottom"),
        _owned(4, "bottom"),
        _owned(5, "shoes"),
    ]
    essentials_by_category = {"shoes": [_essential(101, "shoes"), _essential(102, "shoes")]}

    result = supplement_essentials(
        _filter_result(owned), [], essentials_by_category, min_feels_like_temperature=15.0
    )

    assert result.is_clothing_shortage is True
    shoes = [c for c in result.candidates if c.category_cd == "shoes"]
    assert len(shoes) == 2
    assert shoes[1].key == "e101"
    assert shoes[1].source_cd == "essential"
    tops = [c for c in result.candidates if c.category_cd == "top"]
    bottoms = [c for c in result.candidates if c.category_cd == "bottom"]
    assert all(c.source_cd == "owned" for c in tops + bottoms)


def test_empty_closet_fills_two_of_each_required_category():
    essentials_by_category = {
        "top": [_essential(1, "top"), _essential(2, "top")],
        "bottom": [_essential(3, "bottom"), _essential(4, "bottom")],
        "shoes": [_essential(5, "shoes"), _essential(6, "shoes")],
    }

    result = supplement_essentials(
        _filter_result([]), [], essentials_by_category, min_feels_like_temperature=15.0
    )

    assert result.is_clothing_shortage is True
    for category_cd in ("top", "bottom", "shoes"):
        items = [c for c in result.candidates if c.category_cd == category_cd]
        assert len(items) == 2
        assert all(c.source_cd == "essential" for c in items)


def test_outer_required_and_missing_adds_one_essential_outer():
    essentials_by_category = {"outer": [_essential(201, "outer")]}

    result = supplement_essentials(
        _filter_result(_full_basics(), outer_requirement="required"),
        [],
        essentials_by_category,
        min_feels_like_temperature=15.0,
    )

    outers = [c for c in result.candidates if c.category_cd == "outer"]
    assert len(outers) == 1
    assert outers[0].key == "e201"
    assert outers[0].source_cd == "essential"
    # 아우터 보충 자체는 "부족"이 아니라 "필수 공백" 처리이므로 shortage는 올리지 않는다
    assert result.is_clothing_shortage is False
    assert result.outer_requirement == "required"


def test_outer_required_but_unfillable_downgrades_to_optional_and_flags_shortage():
    # 여름 결혼식처럼 아우터가 필수인데 보유·에센셜 어디에도 쓸 아우터가 없는 경우
    result = supplement_essentials(
        _filter_result(_full_basics(), outer_requirement="required"),
        [],
        {},
        min_feels_like_temperature=25.0,
    )

    assert [c for c in result.candidates if c.category_cd == "outer"] == []
    assert result.outer_requirement == "optional"
    assert result.is_clothing_shortage is True


def test_outer_excluded_removes_owned_outers():
    owned = _full_basics() + [_owned(10, "outer"), _owned(11, "outer")]

    result = supplement_essentials(
        _filter_result(owned, outer_requirement="excluded"),
        [],
        {},
        min_feels_like_temperature=25.0,
    )

    assert [c for c in result.candidates if c.category_cd == "outer"] == []
    assert result.outer_requirement == "excluded"


def test_preferred_style_is_prioritized_within_category_cap():
    owned = [_owned(i, "top", styles=["casual"]) for i in range(1, 9)]  # 8벌, 선호 아님
    preferred_owned = _owned(9, "top", styles=["minimal"])  # 선호 스타일
    owned.append(preferred_owned)

    result = supplement_essentials(
        _filter_result(owned), ["minimal"], {}, min_feels_like_temperature=15.0
    )

    tops = [c for c in result.candidates if c.category_cd == "top"]
    assert len(tops) == 8
    assert tops[0].key == "o9"


def test_accessories_cap_is_applied_per_accessory_type():
    hats = [_owned(i, "accessories", accessory_type_cd="hat") for i in range(101, 111)]  # 10개
    bag = _owned(111, "accessories", accessory_type_cd="bag")

    result = supplement_essentials(
        _filter_result(_full_basics() + hats + [bag]), [], {}, min_feels_like_temperature=15.0
    )

    accessories = [c for c in result.candidates if c.category_cd == "accessories"]
    assert len([c for c in accessories if c.accessory_type_cd == "hat"]) == 8
    assert candidate_key("owned", 111) in {c.key for c in accessories}


def test_essential_fails_thickness_rule_is_not_used_to_fill_shortage():
    # 겨울(체감 -5도)인데 에센셜 아우터가 thin뿐이면, REC-08 두께 규칙에 걸려 보충에 쓰이지 않는다.
    thin_outer = _essential(301, "outer", thickness_cd="thin")
    essentials_by_category = {"outer": [thin_outer]}

    result = supplement_essentials(
        _filter_result([], outer_requirement="required"),
        [],
        essentials_by_category,
        min_feels_like_temperature=-5.0,
    )

    assert result.candidates == []


def test_untagged_category_owned_item_is_excluded():
    untagged = _owned(1, None)
    owned = [untagged, _owned(2, "top"), _owned(3, "top")]

    result = supplement_essentials(_filter_result(owned), [], {}, min_feels_like_temperature=15.0)

    assert all(c.category_cd is not None for c in result.candidates)
    assert len(result.candidates) == 2


def test_precipitation_expected_prioritizes_waterproof_over_style_in_cap():
    preferred_non_waterproof = [
        _owned(i, "shoes", styles=["minimal"], is_waterproof=False) for i in range(1, 9)
    ]
    waterproof_non_preferred = _owned(9, "shoes", styles=["casual"], is_waterproof=True)
    owned = preferred_non_waterproof + [waterproof_non_preferred]

    result = supplement_essentials(
        _filter_result(owned, precipitation_expected=True),
        ["minimal"],
        {},
        min_feels_like_temperature=15.0,
    )

    shoes = [c for c in result.candidates if c.category_cd == "shoes"]
    assert len(shoes) == 8
    assert shoes[0].key == "o9"
    assert shoes[0].is_waterproof is True


def _thin_clothing_min() -> float:
    return float(get_settings().THIN_CLOTHING_MIN_FEELS_LIKE_TEMPERATURE)


def _cold() -> float:
    return _thin_clothing_min() - 0.1


def _mild() -> float:
    return _thin_clothing_min() + 7.0


def _essential_key(item: EssentialItemCandidate) -> str:
    return candidate_key("essential", item.essential_item_id)


def _picked_outer_key(
    essentials: list[EssentialItemCandidate],
    min_feels_like: float,
    preferred_styles: list[str] | None = None,
    precipitation_expected: bool = False,
) -> str:
    result = supplement_essentials(
        _filter_result(
            _full_basics(),
            outer_requirement="required",
            precipitation_expected=precipitation_expected,
        ),
        preferred_styles or [],
        {"outer": essentials},
        min_feels_like_temperature=min_feels_like,
    )
    outers = [c for c in result.candidates if c.category_cd == "outer"]
    assert len(outers) == 1
    return outers[0].key


def test_cold_day_picks_thick_essential_outer_over_formality_order():
    hoodie = _essential(7, "outer", thickness_cd="medium")
    trench = _essential(2, "outer", style_cd="minimal", thickness_cd="medium")
    blazer = _essential(3, "outer", style_cd="classic", thickness_cd="medium")
    wool_coat = _essential(4, "outer", style_cd="classic", thickness_cd="thick")

    assert _picked_outer_key([hoodie, trench, blazer, wool_coat], _cold()) == _essential_key(
        wool_coat
    )


def test_thick_outer_is_first_only_below_thin_clothing_minimum():
    medium = _essential(1, "outer", thickness_cd="medium")
    thick = _essential(2, "outer", thickness_cd="thick")

    assert _picked_outer_key([medium, thick], _thin_clothing_min()) == _essential_key(medium)
    assert _picked_outer_key([medium, thick], _cold()) == _essential_key(thick)


def test_cold_day_thickness_comes_before_preferred_style():
    preferred_medium = _essential(1, "outer", style_cd="casual", thickness_cd="medium")
    thick = _essential(2, "outer", style_cd="classic", thickness_cd="thick")

    picked = _picked_outer_key([preferred_medium, thick], _cold(), preferred_styles=["casual"])

    assert picked == _essential_key(thick)


def test_mild_day_thickness_comes_before_preferred_style():
    preferred_thick = _essential(1, "outer", style_cd="classic", thickness_cd="thick")
    medium = _essential(2, "outer", style_cd="casual", thickness_cd="medium")

    picked = _picked_outer_key([preferred_thick, medium], _mild(), preferred_styles=["classic"])

    assert picked == _essential_key(medium)


def test_mild_day_picks_medium_outer_before_thin_without_preferred_style():
    thin = _essential(1, "outer", thickness_cd="thin")
    medium = _essential(2, "outer", thickness_cd="medium")

    assert _picked_outer_key([thin, medium], _mild()) == _essential_key(medium)


def test_mild_day_picks_medium_outer_when_preferred_style_matches_only_thin():
    preferred_thin = _essential(1, "outer", style_cd="sporty", thickness_cd="thin")
    medium = _essential(2, "outer", style_cd="casual", thickness_cd="medium")

    picked = _picked_outer_key([preferred_thin, medium], _mild(), preferred_styles=["sporty"])

    assert picked == _essential_key(medium)


def test_mild_day_picks_thin_outer_before_thick():
    thick = _essential(1, "outer", thickness_cd="thick")
    thin = _essential(2, "outer", thickness_cd="thin")

    assert _picked_outer_key([thick, thin], _mild()) == _essential_key(thin)


def test_outer_without_thickness_ranks_with_medium_on_mild_day():
    thin = _essential(1, "outer", thickness_cd="thin")
    untagged = _essential(2, "outer", thickness_cd=None)

    assert _picked_outer_key([thin, untagged], _mild()) == _essential_key(untagged)


def test_precipitation_prioritizes_waterproof_outer_over_thickness_and_style_on_cold_day():
    preferred_thick = _essential(1, "outer", style_cd="classic", thickness_cd="thick")
    waterproof = _essential(2, "outer", thickness_cd="medium", is_waterproof=True)

    picked = _picked_outer_key(
        [preferred_thick, waterproof],
        _cold(),
        preferred_styles=["classic"],
        precipitation_expected=True,
    )

    assert picked == _essential_key(waterproof)


def test_precipitation_prioritizes_thin_waterproof_outer_on_mild_day():
    preferred_medium = _essential(1, "outer", style_cd="classic", thickness_cd="medium")
    waterproof_thin = _essential(2, "outer", thickness_cd="thin", is_waterproof=True)

    picked = _picked_outer_key(
        [preferred_medium, waterproof_thin],
        _mild(),
        preferred_styles=["classic"],
        precipitation_expected=True,
    )

    assert picked == _essential_key(waterproof_thin)


def test_cold_rainy_day_excludes_thin_waterproof_outer():
    waterproof_thin = _essential(1, "outer", thickness_cd="thin", is_waterproof=True)
    thick = _essential(2, "outer", thickness_cd="thick")

    picked = _picked_outer_key([waterproof_thin, thick], _cold(), precipitation_expected=True)

    assert picked == _essential_key(thick)


def test_same_thickness_outers_keep_preferred_style_then_fetched_order():
    first = _essential(1, "outer", style_cd="casual", thickness_cd="medium")
    second = _essential(2, "outer", style_cd="casual", thickness_cd="medium")
    preferred = _essential(3, "outer", style_cd="minimal", thickness_cd="medium")
    outers = [first, second, preferred]

    assert _picked_outer_key(outers, _mild()) == _essential_key(first)
    assert _picked_outer_key(outers, _mild(), ["minimal"]) == _essential_key(preferred)


def test_only_thick_outers_still_fill_required_outer_on_mild_day():
    thick_outers = [
        _essential(1, "outer", thickness_cd="thick"),
        _essential(2, "outer", thickness_cd="thick"),
    ]

    assert _picked_outer_key(thick_outers, _mild()) == _essential_key(thick_outers[0])


@pytest.mark.parametrize("category_cd", ["top", "bottom", "shoes"])
@pytest.mark.parametrize(
    ("min_feels_like", "thicknesses"),
    [(_cold, ["medium", "medium", "thick"]), (_mild, ["thick", "thin", "medium"])],
)
def test_shortage_supplement_keeps_fetched_order_regardless_of_thickness(
    category_cd, min_feels_like, thicknesses
):
    owned = [c for c in _full_basics() if c.category_cd != category_cd]
    essentials = [
        _essential(item_id, category_cd, thickness_cd=thickness)
        for item_id, thickness in enumerate(thicknesses, start=1)
    ]

    result = supplement_essentials(
        _filter_result(owned),
        [],
        {category_cd: essentials},
        min_feels_like_temperature=min_feels_like(),
    )

    picked = [c.key for c in result.candidates if c.category_cd == category_cd]
    assert picked == [_essential_key(e) for e in essentials[:2]]


@pytest.mark.parametrize(
    ("min_feels_like", "kept_thickness", "last_thickness"),
    [(_cold, "medium", "thick"), (_mild, "thick", "medium")],
)
def test_category_cap_keeps_owned_order_regardless_of_thickness(
    min_feels_like, kept_thickness, last_thickness
):
    outers = [_owned(i, "outer", thickness_cd=kept_thickness) for i in range(101, 109)]
    outers.append(_owned(109, "outer", thickness_cd=last_thickness))

    result = supplement_essentials(
        _filter_result(_full_basics() + outers, outer_requirement="required"),
        [],
        {},
        min_feels_like_temperature=min_feels_like(),
    )

    picked = [c.key for c in result.candidates if c.category_cd == "outer"]
    assert picked == [candidate_key("owned", c.clothing_id) for c in outers[:8]]


def test_optional_outer_does_not_add_essential_outer():
    result = supplement_essentials(
        _filter_result(_full_basics(), outer_requirement="optional"),
        [],
        {"outer": [_essential(1, "outer")]},
        min_feels_like_temperature=18.0,
    )

    assert [c for c in result.candidates if c.category_cd == "outer"] == []
    assert result.outer_requirement == "optional"


def test_candidate_ids_follow_prompt_candidate_key_rule():
    owned = [_owned(1042, "top"), _owned(1043, "top"), _owned(1, "bottom"), _owned(2, "bottom")]
    essentials_by_category = {"shoes": [_essential(31, "shoes"), _essential(32, "shoes")]}

    result = supplement_essentials(
        _filter_result(owned), [], essentials_by_category, min_feels_like_temperature=15.0
    )

    ids = {c.key for c in result.candidates}
    assert candidate_key("owned", 1042) in ids
    assert candidate_key("essential", 31) in ids


async def test_fetch_essential_items_falls_back_to_full_formality_range_when_narrow_range_is_empty(
    monkeypatch,
):
    calls = []

    async def fake_get_essential_items(
        db, category_cd, season_cd, gender_cd, min_formality, max_formality
    ):
        calls.append((min_formality, max_formality))
        if (min_formality, max_formality) == DEFAULT_FORMALITY_RANGE:
            return [_essential(999, category_cd)]
        return []

    monkeypatch.setattr(essential_item_repo, "get_essential_items", fake_get_essential_items)

    context = SimpleNamespace(season_cd="summer", gender_cd="unisex")
    items = await _fetch_essential_items(
        db=None, category_cd="bottom", context=context, min_formality=2, max_formality=5
    )

    assert calls == [(2, 5), (1, 5)]
    assert len(items) == 1
    assert items[0].essential_item_id == 999


async def test_fetch_essential_items_does_not_fall_back_when_narrow_range_has_items(monkeypatch):
    async def fake_get_essential_items(
        db, category_cd, season_cd, gender_cd, min_formality, max_formality
    ):
        assert (min_formality, max_formality) == (2, 5)
        return [_essential(1, category_cd)]

    monkeypatch.setattr(essential_item_repo, "get_essential_items", fake_get_essential_items)
    context = SimpleNamespace(season_cd="summer", gender_cd="unisex")
    items = await _fetch_essential_items(
        db=None, category_cd="bottom", context=context, min_formality=2, max_formality=5
    )

    assert len(items) == 1


def test_formality_range_for_preset_tpo_uses_table():
    assert formality_range_for_tpo("formal", "preset") == (4, 5)
    assert formality_range_for_tpo("exercise", "preset") == (1, 3)
    assert formality_range_for_tpo("date", "preset") == (2, 4)


def test_formality_range_table_covers_every_preset_tpo():
    assert set(FORMALITY_RANGE_BY_TPO) == set(get_args(TpoCd)) - {"custom"}


def test_formality_range_for_custom_input_is_not_restricted():
    # 자유 입력 TPO는 격식 구간을 제한하지 않는다 (FR-REC-03-1).
    # tpo_cd가 프리셋 코드와 겹쳐도 입력 유형이 preset이 아니면 전체 구간을 쓴다.
    assert formality_range_for_tpo("formal", "custom") == DEFAULT_FORMALITY_RANGE
