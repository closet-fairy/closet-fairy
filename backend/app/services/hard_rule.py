import re
from collections import Counter, defaultdict
from collections.abc import Collection, Mapping, Sequence
from typing import Protocol, get_args

from app.services.outfit_validation import OutfitValidation
from app.services.prompt.outfit_generation import (
    ACCESSORY_TYPES,
    CandidateItem,
    KeptOutfit,
    OutfitType,
    validate_candidates,
)

SINGLE_ITEM_CATEGORIES = ("outer", "top", "bottom", "shoes", "socks")
UNLIMITED_ACCESSORY_TYPES = ("jewelry", "etc")
SINGLE_WEAR_ACCESSORY_TYPES = tuple(
    t for t in ACCESSORY_TYPES if t not in UNLIMITED_ACCESSORY_TYPES
)

_CATEGORY_OBJECTS = {
    "outer": "아우터(outer)를",
    "top": "상의(top)를",
    "bottom": "하의(bottom)를",
    "shoes": "신발(shoes)을",
    "socks": "양말(socks)을",
}
_SEQ_WITH_PARTICLE = {1: "1과", 2: "2와", 3: "3과", 4: "4와"}
# 후보에 없는 id는 LLM이 만든 임의 문자열이라, 이 형식일 때만 사유(다음 프롬프트·로그)에
# 원문을 넣는다
_DISPLAYABLE_KEY = re.compile(r"[A-Za-z0-9]{1,16}")


class HardRuleTarget(Protocol):
    @property
    def outfit_seq(self) -> int: ...

    @property
    def outfit_type(self) -> OutfitType: ...

    @property
    def item_keys(self) -> Sequence[str]: ...


def validate_hard_rules(
    drafts: Sequence[HardRuleTarget],
    kept_outfits: Sequence[KeptOutfit],
    *,
    candidates: Sequence[CandidateItem],
    is_outer_required: bool,
    season_cd: str,
    avoided_styles: Collection[str],
    avoided_colors: Collection[str],
) -> list[OutfitValidation]:
    draft_seqs = [d.outfit_seq for d in drafts]
    kept_seqs = [k.outfit_seq for k in kept_outfits]
    all_seqs = draft_seqs + kept_seqs
    if any(not 1 <= seq <= 4 for seq in all_seqs) or len(all_seqs) != len(set(all_seqs)):
        raise ValueError(
            f"세트 번호는 1~4이고 서로 달라야 합니다: 검사할 세트 {draft_seqs}, "
            f"이미 정해진 세트 {kept_seqs}"
        )
    for draft in drafts:
        if draft.outfit_type not in get_args(OutfitType):
            raise ValueError(f"알 수 없는 코드값입니다: {draft.outfit_type}")
    if not candidates:
        raise ValueError("후보 목록이 비었습니다.")
    validate_candidates(candidates)
    by_key = {c.key: c for c in candidates}

    ordered = sorted(drafts, key=lambda d: d.outfit_seq)
    reasons_by_seq = {
        draft.outfit_seq: _check_outfit(
            draft,
            by_key,
            is_outer_required=is_outer_required,
            season_cd=season_cd,
            avoided_styles=set(avoided_styles),
            avoided_colors=set(avoided_colors),
        )
        for draft in ordered
    }

    taken = [
        (frozenset(k.item_keys), f"이미 정해진 세트 {_SEQ_WITH_PARTICLE[k.outfit_seq]}")
        for k in sorted(kept_outfits, key=lambda k: k.outfit_seq)
    ]
    for draft in ordered:
        combo = frozenset(draft.item_keys)
        reasons = reasons_by_seq[draft.outfit_seq]
        same = next((label for taken_combo, label in taken if taken_combo == combo), None)
        if same is not None:
            reasons.append(f"{same} 아이템 조합이 같다.")
        elif not reasons:
            # 다른 이유로 탈락한 앞 세트는 어차피 버려지므로 같은 조합 판정의 기준에서 뺀다
            # (재생성 기회 낭비 방지)
            taken.append((combo, f"세트 {_SEQ_WITH_PARTICLE[draft.outfit_seq]}"))

    return [
        OutfitValidation(seq, passed=not reasons, reasons=tuple(reasons))
        for seq, reasons in reasons_by_seq.items()
    ]


def _check_outfit(
    draft: HardRuleTarget,
    by_key: Mapping[str, CandidateItem],
    *,
    is_outer_required: bool,
    season_cd: str,
    avoided_styles: set[str],
    avoided_colors: set[str],
) -> list[str]:
    reasons: list[str] = []

    unknown = {key for key in draft.item_keys if key not in by_key}
    if unknown:
        reasons.append(_unknown_reason(unknown))

    counts = Counter(key for key in draft.item_keys if key in by_key)
    duplicated = sorted(key for key, count in counts.items() if count > 1)
    if duplicated:
        reasons.append(f"같은 아이템을 두 번 넣었다: {', '.join(duplicated)}.")

    items = [by_key[key] for key in sorted(counts)]
    keys_by_category: dict[str, list[str]] = defaultdict(list)
    for item in items:
        keys_by_category[item.category_cd].append(item.key)

    if "top" not in keys_by_category:
        if "outer" in keys_by_category:
            reasons.append("아우터는 있는데 상의(top)가 없다.")
        else:
            reasons.append("상의(top)가 없다.")
    if "bottom" not in keys_by_category:
        reasons.append("하의(bottom)가 없다.")
    if "shoes" not in keys_by_category:
        reasons.append("신발(shoes)이 없다.")
    if is_outer_required and "outer" not in keys_by_category:
        reasons.append("아우터가 필수인데 outer가 없다.")

    for category in SINGLE_ITEM_CATEGORIES:
        keys = keys_by_category.get(category, [])
        if len(keys) > 1:
            reasons.append(
                f"{_CATEGORY_OBJECTS[category]} {len(keys)}개 넣었다: {', '.join(keys)}. "
                "세트당 1개까지다."
            )

    keys_by_accessory: dict[str, list[str]] = defaultdict(list)
    for item in items:
        if item.accessory_type_cd in SINGLE_WEAR_ACCESSORY_TYPES:
            keys_by_accessory[item.accessory_type_cd].append(item.key)
    for accessory_type in SINGLE_WEAR_ACCESSORY_TYPES:
        keys = keys_by_accessory.get(accessory_type, [])
        if len(keys) > 1:
            reasons.append(
                f"같은 종류의 악세서리({accessory_type})를 {len(keys)}개 넣었다: "
                f"{', '.join(keys)}. 종류별로 세트당 1개까지다."
            )

    off_season = [item.key for item in items if item.seasons and season_cd not in item.seasons]
    if off_season:
        reasons.append(
            f"이번 계절({season_cd})에 맞지 않는 아이템을 썼다: {', '.join(off_season)}."
        )

    if draft.outfit_type == "exploratory":
        styled = []
        for item in items:
            hits = sorted(set(item.style_cds) & avoided_styles)
            if hits:
                styled.append(f"{item.key}({','.join(hits)})")
        if styled:
            reasons.append(f"탐색 코디에 기피 스타일 아이템을 썼다: {', '.join(styled)}.")
        colored = [
            f"{item.key}({item.color_cd})" for item in items if item.color_cd in avoided_colors
        ]
        if colored:
            reasons.append(f"탐색 코디에 기피 색상 아이템을 썼다: {', '.join(colored)}.")

    return reasons


def _unknown_reason(unknown: Collection[str]) -> str:
    parts = sorted(key for key in unknown if _DISPLAYABLE_KEY.fullmatch(key))
    malformed = len(unknown) - len(parts)
    if malformed:
        parts.append(f"형식이 올바르지 않은 id {malformed}개")
    return f"후보 목록에 없는 아이템을 썼다: {', '.join(parts)}."
