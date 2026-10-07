"""에센셜 의류 보충 (REC-09).

보유 의류로만 상의·하의·신발이 2벌 미만이거나 필수 아우터가 없을 때
essential_item 마스터에서 보충한다. 핵심 로직(supplement_essentials)은
DB·외부 API 호출이 없는 순수 함수이고, DB 조회는 collect_essential_candidates()가 담당한다.
"""

from collections import Counter
from dataclasses import dataclass

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import AsyncSessionLocal
from app.repositories import essential_item as essential_item_repo
from app.repositories.clothing import ClothingCandidate
from app.repositories.essential_item import EssentialItemCandidate
from app.services.clothing_shortage import (
    MIN_ITEMS_PER_CATEGORY,
    SHORTAGE_CHECK_CATEGORIES,
    shortage_categories_from_counts,
)
from app.services.prompt.outfit_generation import ItemSource, candidate_key
from app.services.recommend_context import RecommendContext
from app.services.rule_filter import FilterResult, OuterRequirement, thickness_matches

MAX_CANDIDATES_PER_CATEGORY = 8  # 악세서리는 종류(accessory_type_cd)별로 따로 적용

# TPO 프리셋별 에센셜 formality_level 허용 구간 (2026-10-03 팀 확정).
# 자유 입력(custom)은 formality_range_for_tpo()에서 전체 구간을 쓰므로 표에 없다.
# 구간에 맞는 에센셜이 하나도 없으면 _fetch_essential_items()가 전체 구간(1~5)으로
# 재조회한다. 시드 데이터가 모든 계절×TPO 조합을 다 못 채워도 코디 자체가 비는 상황을 막는다.
FORMALITY_RANGE_BY_TPO: dict[str, tuple[int, int]] = {
    "daily": (1, 5),
    "work": (2, 5),
    "formal": (4, 5),
    "exercise": (1, 3),
    "rainy": (1, 5),
    "midwinter": (1, 5),
}
DEFAULT_FORMALITY_RANGE = (1, 5)


@dataclass
class SupplementedCandidate:
    id: str  # candidate_key() 규칙을 따른다 — 보유: "o1042", 에센셜: "e31"
    item_id: int
    source_cd: ItemSource
    category_cd: str
    accessory_type_cd: str | None
    item_name: str | None
    color_cd: str | None
    styles: list[str]
    thickness_cd: str | None
    is_waterproof: bool | None
    seasons: list[str]


@dataclass
class SupplementResult:
    """보충 결과.

    outer_requirement는 실제로 적용할 아우터 필요도다. 필수(required)인데 보유·에센셜
    어디에도 쓸 아우터가 없으면 optional로 낮춘다. 이후 단계(프롬프트, 1차 검증)는
    FilterResult가 아니라 이 값을 써야 한다.
    """

    candidates: list[SupplementedCandidate]
    is_clothing_shortage: bool
    outer_requirement: OuterRequirement


def _from_owned(candidate: ClothingCandidate) -> SupplementedCandidate:
    return SupplementedCandidate(
        id=candidate_key("owned", candidate.clothing_id),
        item_id=candidate.clothing_id,
        source_cd="owned",
        category_cd=candidate.category_cd,
        accessory_type_cd=candidate.accessory_type_cd,
        item_name=candidate.item_name,
        color_cd=candidate.color_cd,
        styles=candidate.styles,
        thickness_cd=candidate.thickness_cd,
        is_waterproof=candidate.is_waterproof,
        seasons=list(candidate.seasons),
    )


def _from_essential(item: EssentialItemCandidate) -> SupplementedCandidate:
    return SupplementedCandidate(
        id=candidate_key("essential", item.essential_item_id),
        item_id=item.essential_item_id,
        source_cd="essential",
        category_cd=item.category_cd,
        accessory_type_cd=item.accessory_type_cd,
        item_name=item.item_name,
        color_cd=item.color_cd,
        styles=[item.style_cd],
        thickness_cd=item.thickness_cd,
        is_waterproof=item.is_waterproof,
        seasons=[],
    )


def _sort_candidates(
    items: list[SupplementedCandidate], preferred_styles: list[str], precipitation_expected: bool
) -> list[SupplementedCandidate]:
    """방수 우선(비 예보 때) > 선호 스타일 우선 순으로 정렬한다."""
    preferred = set(preferred_styles)

    def sort_key(c: SupplementedCandidate) -> tuple[int, int]:
        waterproof_rank = 0 if (precipitation_expected and c.is_waterproof) else 1
        style_rank = 0 if preferred.intersection(c.styles) else 1
        return (waterproof_rank, style_rank)

    return sorted(items, key=sort_key)


def _cap_groups(
    category_cd: str, items: list[SupplementedCandidate]
) -> list[list[SupplementedCandidate]]:
    """상한을 적용할 묶음을 돌려준다.

    악세서리는 모자·가방·벨트 등 종류가 한 카테고리에 섞여 있어, 한 종류가
    상한을 다 차지하지 않도록 종류별로 나눠 자른다.
    """
    if category_cd != "accessories":
        return [items]
    groups: dict[str | None, list[SupplementedCandidate]] = {}
    for c in items:
        groups.setdefault(c.accessory_type_cd, []).append(c)
    return list(groups.values())


def formality_range_for_tpo(tpo_cd: str, tpo_input_type_cd: str) -> tuple[int, int]:
    """자유 입력 TPO는 격식 구간을 제한하지 않는다 (FR-REC-03-1과 같은 원칙)."""
    if tpo_input_type_cd != "preset":
        return DEFAULT_FORMALITY_RANGE
    return FORMALITY_RANGE_BY_TPO.get(tpo_cd, DEFAULT_FORMALITY_RANGE)


def shortage_categories(candidates: list[ClothingCandidate]) -> set[str]:
    """부족한 카테고리(두 벌 미만인 top/bottom/shoes)를 돌려준다."""
    counts = Counter(c.category_cd for c in candidates if c.category_cd is not None)
    return shortage_categories_from_counts(counts)


def supplement_essentials(
    filter_result: FilterResult,
    preferred_styles: list[str],
    essential_items_by_category: dict[str, list[EssentialItemCandidate]],
    min_feels_like_temperature: float,
) -> SupplementResult:
    """순수 함수: 보유 후보 + (이미 조회된) 에센셜 후보로 최종 후보 목록을 구성한다."""
    by_category: dict[str, list[SupplementedCandidate]] = {}
    for candidate in filter_result.candidates:
        if candidate.category_cd is None:
            continue  # 태깅 실패로 분류가 없는 옷은 카테고리 기반 보충 로직에서 제외한다
        by_category.setdefault(candidate.category_cd, []).append(_from_owned(candidate))

    is_clothing_shortage = False
    precipitation_expected = filter_result.precipitation_expected
    outer_requirement = filter_result.outer_requirement

    def _essentials_for(category_cd: str) -> list[SupplementedCandidate]:
        # 에센셜도 REC-08과 같은 두께·체감온도 규칙을 통과해야 한다.
        raw = essential_items_by_category.get(category_cd, [])
        filtered = [e for e in raw if thickness_matches(e, min_feels_like_temperature)]
        return _sort_candidates(
            [_from_essential(e) for e in filtered], preferred_styles, precipitation_expected
        )

    shortage = shortage_categories(filter_result.candidates)
    for category_cd in SHORTAGE_CHECK_CATEGORIES:
        current = by_category.setdefault(category_cd, [])
        if category_cd in shortage:
            is_clothing_shortage = True
            needed = MIN_ITEMS_PER_CATEGORY - len(current)
            current.extend(_essentials_for(category_cd)[:needed])

    if outer_requirement == "excluded":
        # 체감온도가 높아 아우터를 입지 않는 날: 보유 아우터도 후보에서 뺀다.
        by_category.pop("outer", None)
    elif outer_requirement == "required" and not by_category.get("outer"):
        essentials = _essentials_for("outer")
        if essentials:
            by_category["outer"] = [essentials[0]]
        else:
            # 보유·에센셜 모두 쓸 아우터가 없으면 필수를 지킬 수 없다.
            # 이후 검증에서 코디 전체가 탈락하지 않도록 선택으로 낮추고 부족으로 표시한다.
            outer_requirement = "optional"
            is_clothing_shortage = True

    final_candidates: list[SupplementedCandidate] = []
    for category_cd, items in by_category.items():
        for group in _cap_groups(category_cd, items):
            final_candidates.extend(
                _sort_candidates(group, preferred_styles, precipitation_expected)[
                    :MAX_CANDIDATES_PER_CATEGORY
                ]
            )

    return SupplementResult(
        candidates=final_candidates,
        is_clothing_shortage=is_clothing_shortage,
        outer_requirement=outer_requirement,
    )


async def _fetch_essential_items(
    db: AsyncSession,
    category_cd: str,
    context: RecommendContext,
    min_formality: int,
    max_formality: int,
) -> list[EssentialItemCandidate]:
    items = await essential_item_repo.get_essential_items(
        db,
        category_cd=category_cd,
        season_cd=context.season_cd,
        gender_cd=context.gender_cd,
        min_formality=min_formality,
        max_formality=max_formality,
    )
    if not items and (min_formality, max_formality) != DEFAULT_FORMALITY_RANGE:
        # 격식 구간에 맞는 에센셜이 하나도 없으면 구간을 풀어 재조회한다.
        # (시드가 모든 계절×TPO 조합을 못 채워도 코디 자체가 비는 상황은 막는다)
        items = await essential_item_repo.get_essential_items(
            db,
            category_cd=category_cd,
            season_cd=context.season_cd,
            gender_cd=context.gender_cd,
            min_formality=DEFAULT_FORMALITY_RANGE[0],
            max_formality=DEFAULT_FORMALITY_RANGE[1],
        )
    return items


async def collect_essential_candidates(
    context: RecommendContext, filter_result: FilterResult
) -> SupplementResult:
    """부족할 수 있는 카테고리의 에센셜 후보만 DB에서 모아 supplement_essentials()에 넘긴다."""
    categories = shortage_categories(filter_result.candidates)
    has_owned_outer = any(c.category_cd == "outer" for c in filter_result.candidates)
    if filter_result.outer_requirement == "required" and not has_owned_outer:
        categories.add("outer")

    essential_items_by_category: dict[str, list[EssentialItemCandidate]] = {}
    if categories:
        min_formality, max_formality = formality_range_for_tpo(
            context.tpo_cd, context.tpo_input_type_cd
        )
        async with AsyncSessionLocal() as db:
            for category_cd in categories:
                essential_items_by_category[category_cd] = await _fetch_essential_items(
                    db, category_cd, context, min_formality, max_formality
                )

    return supplement_essentials(
        filter_result,
        context.preferred_styles,
        essential_items_by_category,
        context.weather.min_feels_like_temperature,
    )
