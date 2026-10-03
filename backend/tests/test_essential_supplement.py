"""REC-09 에센셜 보충(supplement_essentials) 단위 테스트."""

from app.repositories.clothing import ClothingCandidate
from app.repositories.essential_item import EssentialItemCandidate
from app.services.essential_supplement import supplement_essentials
from app.services.rule_filter import FilterResult


def _owned(
    clothing_id: int, category_cd: str, styles: list[str] | None = None
) -> ClothingCandidate:
    return ClothingCandidate(
        clothing_id=clothing_id,
        category_cd=category_cd,
        accessory_type_cd=None,
        item_name=f"owned-{clothing_id}",
        color_cd="black",
        thickness_cd="medium",
        is_waterproof=False,
        origin_image_url="http://example.com/img.png",
        cutout_image_url=None,
        styles=styles or [],
        seasons=[],
    )


def _essential(
    essential_item_id: int, category_cd: str, style_cd: str = "casual"
) -> EssentialItemCandidate:
    return EssentialItemCandidate(
        essential_item_id=essential_item_id,
        item_name=f"essential-{essential_item_id}",
        category_cd=category_cd,
        accessory_type_cd=None,
        style_cd=style_cd,
        color_cd="black",
        thickness_cd="medium",
        is_waterproof=False,
        formality_level=1,
        gender_cd="unisex",
    )


def _filter_result(
    candidates: list[ClothingCandidate], outer_requirement="optional"
) -> FilterResult:
    return FilterResult(
        candidates=candidates, outer_requirement=outer_requirement, precipitation_expected=False
    )


def test_no_shortage_when_each_category_has_two_items():
    owned = [
        _owned(1, "top"),
        _owned(2, "top"),
        _owned(3, "bottom"),
        _owned(4, "bottom"),
        _owned(5, "shoes"),
        _owned(6, "shoes"),
    ]
    result = supplement_essentials(_filter_result(owned), [], {})

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

    result = supplement_essentials(_filter_result(owned), [], essentials_by_category)

    assert result.is_clothing_shortage is True
    shoes = [c for c in result.candidates if c.category_cd == "shoes"]
    assert len(shoes) == 2
    assert shoes[1].id == "E101"
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

    result = supplement_essentials(_filter_result([]), [], essentials_by_category)

    assert result.is_clothing_shortage is True
    for category_cd in ("top", "bottom", "shoes"):
        items = [c for c in result.candidates if c.category_cd == category_cd]
        assert len(items) == 2
        assert all(c.source_cd == "essential" for c in items)


def test_outer_required_and_missing_adds_one_essential_outer():
    owned = [
        _owned(1, "top"),
        _owned(2, "top"),
        _owned(3, "bottom"),
        _owned(4, "bottom"),
        _owned(5, "shoes"),
        _owned(6, "shoes"),
    ]
    essentials_by_category = {"outer": [_essential(201, "outer")]}

    result = supplement_essentials(
        _filter_result(owned, outer_requirement="required"), [], essentials_by_category
    )

    outers = [c for c in result.candidates if c.category_cd == "outer"]
    assert len(outers) == 1
    assert outers[0].id == "E201"
    assert outers[0].source_cd == "essential"
    # 아우터 보충 자체는 "부족"이 아니라 "필수 공백" 처리이므로 shortage는 올리지 않는다
    assert result.is_clothing_shortage is False


def test_preferred_style_is_prioritized_within_category_cap():
    owned = [_owned(i, "top", styles=["casual"]) for i in range(1, 9)]  # 8벌, 선호 아님
    preferred_owned = _owned(9, "top", styles=["minimal"])  # 선호 스타일
    owned.append(preferred_owned)

    result = supplement_essentials(_filter_result(owned), ["minimal"], {})

    tops = [c for c in result.candidates if c.category_cd == "top"]
    assert len(tops) == 8
    assert tops[0].id == "9"
