"""REC-09 에센셜 보충(supplement_essentials) 단위 테스트."""

from types import SimpleNamespace

from app.repositories import essential_item as essential_item_repo
from app.repositories.clothing import ClothingCandidate
from app.repositories.essential_item import EssentialItemCandidate
from app.services.essential_supplement import (
    DEFAULT_FORMALITY_RANGE,
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
    assert shoes[1].id == "e101"
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
    assert outers[0].id == "e201"
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
    assert tops[0].id == "o9"


def test_accessories_cap_is_applied_per_accessory_type():
    hats = [_owned(i, "accessories", accessory_type_cd="hat") for i in range(101, 111)]  # 10개
    bag = _owned(111, "accessories", accessory_type_cd="bag")

    result = supplement_essentials(
        _filter_result(_full_basics() + hats + [bag]), [], {}, min_feels_like_temperature=15.0
    )

    accessories = [c for c in result.candidates if c.category_cd == "accessories"]
    assert len([c for c in accessories if c.accessory_type_cd == "hat"]) == 8
    assert candidate_key("owned", 111) in {c.id for c in accessories}


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
    assert shoes[0].id == "o9"
    assert shoes[0].is_waterproof is True


def test_candidate_ids_follow_prompt_candidate_key_rule():
    owned = [_owned(1042, "top"), _owned(1043, "top"), _owned(1, "bottom"), _owned(2, "bottom")]
    essentials_by_category = {"shoes": [_essential(31, "shoes"), _essential(32, "shoes")]}

    result = supplement_essentials(
        _filter_result(owned), [], essentials_by_category, min_feels_like_temperature=15.0
    )

    ids = {c.id for c in result.candidates}
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


def test_formality_range_for_custom_input_is_not_restricted():
    # 자유 입력 TPO는 격식 구간을 제한하지 않는다 (FR-REC-03-1).
    # tpo_cd가 프리셋 코드와 겹쳐도 입력 유형이 preset이 아니면 전체 구간을 쓴다.
    assert formality_range_for_tpo("formal", "custom") == DEFAULT_FORMALITY_RANGE
