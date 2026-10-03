"""에센셜 의류 보충 (REC-09).

보유 의류만으로 상의·하의·신발이 2벌 미만이거나 필수 아우터가 없을 때
essential_item 마스터에서 보충한다. 핵심 로직(supplement_essentials)은
DB·외부 API 호출이 없는 순수 함수이고, DB 조회는 collect_essential_candidates()가 담당한다.
"""

from dataclasses import dataclass
from typing import Literal

from app.core.db import AsyncSessionLocal
from app.repositories import essential_item as essential_item_repo
from app.repositories.clothing import ClothingCandidate
from app.repositories.essential_item import EssentialItemCandidate
from app.services.recommend_context import RecommendContext
from app.services.rule_filter import FilterResult

SourceCd = Literal["owned", "essential"]

SHORTAGE_CHECK_CATEGORIES = ("top", "bottom", "shoes")
MIN_ITEMS_PER_CATEGORY = 2
MAX_CANDIDATES_PER_CATEGORY = 8

# TPO 프리셋별 에센셜 formality_level 허용 구간 (2026-10-03 팀 확정, 시드 커버리지 검증 완료).
# custom은 1차 룰을 건너뛰는 다른 TPO 판정과 달리 범위를 전체(1~5)로 둬 사실상 제한하지 않는다.
FORMALITY_RANGE_BY_TPO: dict[str, tuple[int, int]] = {
    "daily": (1, 5),
    "work": (2, 5),
    "formal": (4, 5),
    "exercise": (1, 3),
    "rainy": (1, 5),
    "midwinter": (1, 5),
    "custom": (1, 5),
}
DEFAULT_FORMALITY_RANGE = (1, 5)


@dataclass
class SupplementedCandidate:
    id: str  # 보유: "1042", 에센셜: "E31"
    source_cd: SourceCd
    category_cd: str
    accessory_type_cd: str | None
    item_name: str | None
    color_cd: str | None
    styles: list[str]
    thickness_cd: str | None
    is_waterproof: bool | None


@dataclass
class SupplementResult:
    candidates: list[SupplementedCandidate]
    is_clothing_shortage: bool


def _from_owned(candidate: ClothingCandidate) -> SupplementedCandidate:
    return SupplementedCandidate(
        id=str(candidate.clothing_id),
        source_cd="owned",
        category_cd=candidate.category_cd,
        accessory_type_cd=candidate.accessory_type_cd,
        item_name=candidate.item_name,
        color_cd=candidate.color_cd,
        styles=candidate.styles,
        thickness_cd=candidate.thickness_cd,
        is_waterproof=candidate.is_waterproof,
    )


def _from_essential(item: EssentialItemCandidate) -> SupplementedCandidate:
    return SupplementedCandidate(
        id=f"E{item.essential_item_id}",
        source_cd="essential",
        category_cd=item.category_cd,
        accessory_type_cd=item.accessory_type_cd,
        item_name=item.item_name,
        color_cd=item.color_cd,
        styles=[item.style_cd],
        thickness_cd=item.thickness_cd,
        is_waterproof=item.is_waterproof,
    )


def _sort_preferred_first(
    items: list[SupplementedCandidate], preferred_styles: list[str]
) -> list[SupplementedCandidate]:
    preferred = set(preferred_styles)
    return sorted(items, key=lambda c: 0 if preferred.intersection(c.styles) else 1)


def formality_range_for_tpo(tpo_cd: str, tpo_input_type_cd: str) -> tuple[int, int]:
    """자유 입력 TPO는 격식 구간을 제한하지 않는다 (FR-REC-03-1과 같은 원칙)."""
    if tpo_input_type_cd != "preset":
        return DEFAULT_FORMALITY_RANGE
    return FORMALITY_RANGE_BY_TPO.get(tpo_cd, DEFAULT_FORMALITY_RANGE)


def supplement_essentials(
    filter_result: FilterResult,
    preferred_styles: list[str],
    essential_items_by_category: dict[str, list[EssentialItemCandidate]],
) -> SupplementResult:
    """순수 함수: 보유 후보 + (이미 조회된) 에센셜 후보로 최종 후보 목록을 구성한다."""
    by_category: dict[str, list[SupplementedCandidate]] = {}
    for candidate in filter_result.candidates:
        by_category.setdefault(candidate.category_cd, []).append(_from_owned(candidate))

    is_clothing_shortage = False

    for category_cd in SHORTAGE_CHECK_CATEGORIES:
        current = by_category.setdefault(category_cd, [])
        if len(current) < MIN_ITEMS_PER_CATEGORY:
            is_clothing_shortage = True
            essentials = _sort_preferred_first(
                [_from_essential(e) for e in essential_items_by_category.get(category_cd, [])],
                preferred_styles,
            )
            needed = MIN_ITEMS_PER_CATEGORY - len(current)
            current.extend(essentials[:needed])

    outer_candidates = by_category.setdefault("outer", [])
    if filter_result.outer_requirement == "required" and not outer_candidates:
        essentials = _sort_preferred_first(
            [_from_essential(e) for e in essential_items_by_category.get("outer", [])],
            preferred_styles,
        )
        if essentials:
            outer_candidates.append(essentials[0])

    final_candidates: list[SupplementedCandidate] = []
    for items in by_category.values():
        final_candidates.extend(
            _sort_preferred_first(items, preferred_styles)[:MAX_CANDIDATES_PER_CATEGORY]
        )

    return SupplementResult(candidates=final_candidates, is_clothing_shortage=is_clothing_shortage)


async def collect_essential_candidates(
    context: RecommendContext, filter_result: FilterResult
) -> SupplementResult:
    """부족할 수 있는 카테고리의 에센셜 후보를 DB에서 모아 supplement_essentials()에 넘긴다."""
    min_formality, max_formality = formality_range_for_tpo(
        context.tpo_cd, context.tpo_input_type_cd
    )

    categories = set(SHORTAGE_CHECK_CATEGORIES)
    owned_outer = [c for c in filter_result.candidates if c.category_cd == "outer"]
    if filter_result.outer_requirement == "required" and not owned_outer:
        categories.add("outer")

    essential_items_by_category: dict[str, list[EssentialItemCandidate]] = {}
    async with AsyncSessionLocal() as db:
        for category_cd in categories:
            essential_items_by_category[
                category_cd
            ] = await essential_item_repo.get_essential_items(
                db,
                category_cd=category_cd,
                season_cd=context.season_cd,
                gender_cd=context.gender_cd,
                min_formality=min_formality,
                max_formality=max_formality,
            )

    return supplement_essentials(
        filter_result, context.preferred_styles, essential_items_by_category
    )
