"""재추천 코디 생성 (#86, REF-04, FR-REF-12~19, EX-REF-05)."""

import logging
import random
from collections import defaultdict
from collections.abc import Callable, Collection, Mapping, Sequence
from dataclasses import dataclass, field, replace
from datetime import datetime
from decimal import Decimal
from typing import Literal

from app.core.config import get_settings
from app.core.db import AsyncSessionLocal
from app.core.logging import Event
from app.repositories import recommendation_result as result_repo
from app.repositories import recommendation_session as session_repo
from app.repositories import regeneration_request as regeneration_repo
from app.repositories import weather_snapshot as weather_snapshot_repo
from app.repositories.recommendation_result import OutfitItemResultRow
from app.repositories.regeneration_request import RegenerationRequestRow
from app.repositories.weather_snapshot import WeatherSnapshotRow
from app.services.essential_supplement import SupplementResult, collect_essential_candidates
from app.services.hard_rule import DISPLAYABLE_KEY
from app.services.llm import LLMClient
from app.services.outfit_generator import (
    MAX_OUTFITS,
    DraftOutfit,
    GenerationResult,
    HardRuleCheck,
    count_possible_combos,
    generate_outfits,
    make_hard_rule_check,
    make_llm_reviewer,
)
from app.services.outfit_validation import OutfitValidation
from app.services.prompt.outfit_generation import (
    CATEGORY_ORDER,
    CandidateItem,
    ItemSource,
    KeptOutfit,
    OutfitPromptInput,
    OutfitType,
    RegenerationInstruction,
    candidate_key,
)
from app.services.recommend_context import RecommendContext, load_context
from app.services.recommendation_pipeline import (
    build_prompt_input,
    load_preferences,
    to_candidate_item,
)
from app.services.recommendation_result import latest_deck_rows
from app.services.recommendation_save import CATEGORY_LABELS
from app.services.recommendation_session import from_db_utc
from app.services.regeneration_intent import RegenerationIntent
from app.services.regeneration_state import feels_like_offset
from app.services.rule_filter import filter_clothing
from app.services.weather.weather_service import HourlyWeather, WeatherResult, min_feels_like

logger = logging.getLogger(__name__)

ACCESSORIES = "accessories"

MissingCause = Literal["lighter", "warmer", "deleted", "unavailable"]
OuterCause = Literal["warmer", "weather"]

_NOTE_PREFIXES: dict[MissingCause, str] = {
    "lighter": "가볍게 입고 싶다는 요청을 반영해",
    "warmer": "따뜻하게 입고 싶다는 요청을 반영해",
    "deleted": "옷장에서 지운 옷이 있어",
    "unavailable": "지금 조건에 맞지 않는 옷이 있어",
}
_OUTER_ADDED_NOTES: dict[OuterCause, str] = {
    "warmer": "따뜻하게 입고 싶다는 요청을 반영해 아우터도 함께 더했어요.",
    "weather": "날씨에 맞춰 아우터도 함께 더했어요.",
}


@dataclass(frozen=True)
class ScreenItem:
    slot_cd: str
    item_source_cd: ItemSource
    key: str | None


@dataclass(frozen=True)
class ScreenOutfit:
    outfit_id: int
    outfit_seq: int
    outfit_type: OutfitType
    items: tuple[ScreenItem, ...]

    @property
    def keys(self) -> tuple[str, ...]:
        return tuple(i.key for i in self.items if i.key is not None)

    @property
    def is_complete(self) -> bool:
        return all(i.key is not None for i in self.items)


@dataclass(frozen=True)
class RegenerationContext:
    context: RecommendContext
    request: RegenerationRequestRow
    intents: list[RegenerationIntent]
    screen: list[ScreenOutfit]


@dataclass(frozen=True)
class MissingItem:
    slot_cd: str
    key: str | None
    cause: MissingCause


@dataclass(frozen=True)
class PartsPlan:
    target_seq: int
    original_keys: tuple[str, ...]
    original_slots: frozenset[str]
    replace_slots: frozenset[str]
    locked_by_slot: Mapping[str, frozenset[str]]
    freed_slots: frozenset[str]
    original_accessories: frozenset[str]
    missing: tuple[MissingItem, ...]
    removed_keys: frozenset[str]
    no_alternative_slots: tuple[str, ...]
    outer_required: bool = False
    outer_to_add: OuterCause | None = None

    @property
    def accessory_missing(self) -> bool:
        return any(m.slot_cd == ACCESSORIES for m in self.missing)


@dataclass(frozen=True)
class RegenerationPlan:
    scope: Literal["single", "all"]
    target_seqs: tuple[int, ...]
    target_type: OutfitType | None
    kept: tuple[KeptOutfit, ...]
    replaced_combos: tuple[frozenset[str], ...]
    parts: PartsPlan | None
    removed_keys: frozenset[str] = frozenset()
    banned_by_slot: Mapping[str, frozenset[str]] = field(default_factory=dict)


@dataclass(frozen=True)
class RegenerationOutcome:
    generation: GenerationResult
    supplement: SupplementResult
    prompt_input: OutfitPromptInput


# ---------- 컨텍스트 복원 ----------


async def load_regeneration_context(regeneration_request_id: int) -> RegenerationContext:
    async with AsyncSessionLocal() as db:
        request = await regeneration_repo.get_request(db, regeneration_request_id)
        if request is None:
            raise ValueError(f"regeneration_request not found: {regeneration_request_id}")
        session_id = request.recommendation_session_id
        session = await session_repo.get_session(db, session_id)
        if session is None:
            raise ValueError(f"recommendation_session not found: {session_id}")
        snapshot = await weather_snapshot_repo.get_weather_snapshot(db, session_id)
        if snapshot is None:
            raise ValueError(f"weather_snapshot not found: {session_id}")

        weather = restore_weather(
            snapshot,
            from_db_utc(session.going_out_start_at),
            from_db_utc(session.going_out_end_at),
        )
        context = await load_context(db, session_id, session, weather)
        completed = await regeneration_repo.find_completed_intents(
            db, session_id, request.request_seq
        )
        rows = latest_deck_rows(await result_repo.get_outfit_items(db, session_id))

    return RegenerationContext(
        context=context,
        request=request,
        intents=[*completed, request.parsed_intent],
        screen=to_screen_outfits(rows),
    )


# created_at은 날씨를 조회한 시각이 아니라 INSERT 시각이고 현재 체감은 소수 한 자리로 저장돼서,
# 현재 체감이 최솟값이었다면 첫 추천과 최대 0.05℃ 다를 수 있다
def restore_weather(
    row: WeatherSnapshotRow, going_out_start: datetime, going_out_end: datetime
) -> WeatherResult:
    hourly = [
        HourlyWeather(
            at=datetime.fromisoformat(h["at"]),
            temperature=float(h["temperature"]),
            feels_like_temperature=float(h["feels_like_temperature"]),
            precipitation=float(h["precipitation"]),
            wind_speed=float(h["wind_speed"]),
            weather_condition_cd=h["weather_condition_cd"],
        )
        for h in row.hourly_forecast
    ]
    current_feels = float(row.feels_like_temperature)
    return WeatherResult(
        temperature=float(row.temperature),
        feels_like_temperature=current_feels,
        precipitation=float(row.precipitation),
        wind_speed=float(row.wind_speed),
        weather_condition_cd=row.weather_condition_cd,
        min_feels_like_temperature=min_feels_like(
            hourly, current_feels, going_out_start, going_out_end, from_db_utc(row.created_at)
        ),
        is_fallback=row.is_fallback,
        hourly=hourly,
    )


# 기온은 실제값으로 두고 체감만 옮긴다
def apply_feels_like_offset(weather: WeatherResult, offset: Decimal) -> WeatherResult:
    delta = float(offset)
    if delta == 0:
        return weather
    return replace(
        weather,
        feels_like_temperature=weather.feels_like_temperature + delta,
        min_feels_like_temperature=weather.min_feels_like_temperature + delta,
        hourly=[
            replace(h, feels_like_temperature=h.feels_like_temperature + delta)
            for h in weather.hourly
        ],
    )


def to_screen_outfits(rows: Sequence[OutfitItemResultRow]) -> list[ScreenOutfit]:
    grouped: dict[int, list[OutfitItemResultRow]] = defaultdict(list)
    for row in rows:
        grouped[row.outfit_id].append(row)

    outfits = []
    for outfit_id, items in grouped.items():
        first = items[0]
        outfits.append(
            ScreenOutfit(
                outfit_id=outfit_id,
                outfit_seq=first.outfit_seq,
                outfit_type=first.outfit_type_cd,
                items=tuple(_to_screen_item(i) for i in items),
            )
        )
    return sorted(outfits, key=lambda o: o.outfit_seq)


def _to_screen_item(row: OutfitItemResultRow) -> ScreenItem:
    item_id = row.clothing_id if row.item_source_cd == "owned" else row.essential_item_id
    key = candidate_key(row.item_source_cd, item_id) if item_id is not None else None
    return ScreenItem(row.slot_cd, row.item_source_cd, key)


def to_kept_outfits(screen: Sequence[ScreenOutfit], target_seqs: Sequence[int]) -> list[KeptOutfit]:
    return [
        KeptOutfit(o.outfit_seq, list(o.keys), o.outfit_type)
        for o in screen
        if o.outfit_seq not in target_seqs and o.keys
    ]


# ---------- 계획 ----------


def plan_regeneration(
    ctx: RegenerationContext,
    candidates: Sequence[CandidateItem],
    classify: Callable[[ScreenItem], MissingCause],
    *,
    outer_required: bool = False,
    outer_cause: OuterCause = "weather",
) -> RegenerationPlan:
    request = ctx.request
    replaced_combos = tuple(frozenset(o.keys) for o in ctx.screen if o.is_complete)
    if request.target_scope_cd == "all":
        banned_by_slot = _ban_screen_items(ctx.screen, request.parsed_intent, candidates)
        return RegenerationPlan(
            scope="all",
            target_seqs=tuple(range(1, MAX_OUTFITS + 1)),
            target_type=None,
            kept=(),
            replaced_combos=replaced_combos,
            parts=None,
            removed_keys=frozenset().union(*banned_by_slot.values()),
            banned_by_slot=banned_by_slot,
        )

    target = next((o for o in ctx.screen if o.outfit_id == request.target_outfit_id), None)
    if target is None:
        raise ValueError(f"대상 코디가 화면에 없습니다: {request.target_outfit_id}")
    replace_slots = frozenset(
        {request.target_slot_cd} if request.target_slot_cd is not None else set()
    ) | frozenset(request.parsed_intent.replace_slots)
    parts = (
        plan_parts(
            target,
            replace_slots,
            candidates,
            classify,
            outer_required=outer_required,
            outer_cause=outer_cause,
        )
        if replace_slots
        else None
    )
    return RegenerationPlan(
        scope="single",
        target_seqs=(target.outfit_seq,),
        target_type=target.outfit_type,
        kept=tuple(to_kept_outfits(ctx.screen, (target.outfit_seq,))),
        replaced_combos=(frozenset(target.keys),) if target.is_complete else (),
        parts=parts,
        removed_keys=parts.removed_keys if parts is not None else frozenset(),
    )


def _ban_screen_items(
    screen: Sequence[ScreenOutfit],
    intent: RegenerationIntent,
    candidates: Sequence[CandidateItem],
) -> dict[str, frozenset[str]]:
    candidate_keys = {c.key for c in candidates}
    banned: dict[str, frozenset[str]] = {}
    for slot in CATEGORY_ORDER:
        if slot not in intent.replace_items or intent.replace_items[slot] is not None:
            continue
        used = {i.key for o in screen for i in o.items if i.slot_cd == slot} & candidate_keys
        others = [c for c in candidates if c.category_cd == slot and c.key not in used]
        if used and others:
            banned[slot] = frozenset(used)
    return banned


def plan_parts(
    target: ScreenOutfit,
    replace_slots: frozenset[str],
    candidates: Sequence[CandidateItem],
    classify: Callable[[ScreenItem], MissingCause],
    *,
    outer_required: bool = False,
    outer_cause: OuterCause = "weather",
) -> PartsPlan:
    candidate_keys = {c.key for c in candidates}
    missing = tuple(
        MissingItem(item.slot_cd, item.key, classify(item))
        for item in target.items
        if item.key not in candidate_keys
        and (item.slot_cd not in replace_slots or item.slot_cd == ACCESSORIES)
    )
    missing_keys = {m.key for m in missing}
    freed_slots = frozenset(m.slot_cd for m in missing if m.slot_cd != ACCESSORIES)

    by_slot: dict[str, set[str]] = defaultdict(set)
    for item in target.items:
        if item.key in candidate_keys and item.key not in missing_keys:
            by_slot[item.slot_cd].add(item.key)
    original_slots = frozenset(i.slot_cd for i in target.items)
    adds_outer = outer_required and "outer" not in original_slots and "outer" not in replace_slots
    locked_by_slot = {
        slot: frozenset(by_slot.get(slot, ()))
        for slot in CATEGORY_ORDER
        if slot not in replace_slots
        and slot not in freed_slots
        and not (adds_outer and slot == "outer")
    }
    original_accessories = frozenset(by_slot.get(ACCESSORIES, ()))

    removed_keys: set[str] = set()
    no_alternative: list[str] = []
    for slot in sorted(replace_slots, key=CATEGORY_ORDER.index):
        current = by_slot.get(slot, set()) | {
            i.key for i in target.items if i.slot_cd == slot and i.key is not None
        }
        alternatives = [c for c in candidates if c.category_cd == slot and c.key not in current]
        if not alternatives:
            no_alternative.append(slot)
        # 악세서리는 그대로 둘 다른 악세서리도 후보에 있어야 해서 지금 아이템을 후보에서 빼지 않는다
        elif slot != ACCESSORIES:
            removed_keys |= current & candidate_keys

    return PartsPlan(
        target_seq=target.outfit_seq,
        original_keys=target.keys,
        original_slots=original_slots,
        replace_slots=replace_slots,
        locked_by_slot=locked_by_slot,
        freed_slots=freed_slots,
        original_accessories=original_accessories,
        missing=missing,
        removed_keys=frozenset(removed_keys),
        no_alternative_slots=tuple(no_alternative),
        outer_required=outer_required,
        outer_to_add=outer_cause if adds_outer else None,
    )


# 두께, 아우터 excluded, 에센셜 아우터 보충 등 체감에 따라 후보가 바뀌는 길이 여러 개라,
# 조건을 하나하나 옮기지 않고 조정 전 날씨로 만든 후보와 비교한다
def make_missing_classifier(
    offset: Decimal,
    keys_before_offset: frozenset[str] | None,
    candidate_keys: set[str],
) -> Callable[[ScreenItem], MissingCause]:
    def classify(item: ScreenItem) -> MissingCause:
        if item.item_source_cd == "owned" and item.key is None:
            return "deleted"
        if (
            offset
            and item.key is not None
            and keys_before_offset is not None
            and item.key in keys_before_offset
            and item.key not in candidate_keys
        ):
            return "lighter" if offset > 0 else "warmer"
        return "unavailable"

    return classify


def choose_exploration_style(
    plan: RegenerationPlan,
    current_intent: RegenerationIntent,
    selected: str | None,
    *,
    locked_avoided: bool = False,
) -> str | None:
    if current_intent.preferred_styles:
        return None
    if plan.scope == "all":
        return selected
    if locked_avoided:
        return None
    return selected if plan.target_type == "exploratory" else None


def locked_has_avoided(
    parts: PartsPlan,
    candidates_by_key: Mapping[str, CandidateItem],
    avoided_styles: Collection[str],
    avoided_colors: Collection[str],
) -> bool:
    for keys in parts.locked_by_slot.values():
        for key in keys:
            item = candidates_by_key.get(key)
            if item is None:
                continue
            if set(item.style_cds) & set(avoided_styles) or item.color_cd in avoided_colors:
                return True
    return False


# ---------- 재추천 지시 ----------


def build_regeneration_instructions(
    plan: RegenerationPlan,
    intent: RegenerationIntent,
    offset: Decimal,
    *,
    locked_avoided: bool = False,
) -> list[RegenerationInstruction]:
    texts: list[str] = []
    if plan.scope == "all":
        if plan.replaced_combos:
            combos = " / ".join(", ".join(sorted(c)) for c in plan.replaced_combos)
            texts.append(f"이전 코디({combos})와 같은 조합을 쓰지 않는다.")
        for slot, keys in plan.banned_by_slot.items():
            texts.append(
                f"모든 세트의 {_slot_text(slot)}{_eun_neun(slot)} 이전 코디에 쓴 것"
                f"({', '.join(sorted(keys))}) 말고 다른 후보로 고른다."
            )
        texts += _name_texts(intent, all_outfits=True)
    elif plan.parts is None:
        target_keys = ", ".join(sorted(next(iter(plan.replaced_combos), ())))
        if target_keys:
            texts.append(
                f"이전 코디({target_keys})를 대신할 세트를 만든다. 이 조합을 그대로 쓰지 않는다."
            )
        else:
            texts.append("이전 코디를 대신할 세트를 만든다.")
    else:
        texts += _parts_texts(plan.parts, locked_avoided=locked_avoided)
        texts += _name_texts(intent, all_outfits=False)
    texts += _warmth_texts(offset)
    return [RegenerationInstruction(seq, text) for seq, text in enumerate(texts, start=1)]


def _slot_text(slot: str) -> str:
    return f"{CATEGORY_LABELS[slot]}({slot})"


def _parts_texts(parts: PartsPlan, *, locked_avoided: bool = False) -> list[str]:
    original = ", ".join(sorted(parts.original_keys))
    kept = sorted(k for keys in parts.locked_by_slot.values() for k in keys)
    texts = [f"이전 코디({original})를 고쳐 새 세트를 만든다."]
    if kept:
        texts.append(f"그대로 쓸 아이템: {', '.join(kept)}.")
        if locked_avoided:
            texts.append("그대로 쓸 아이템은 기피 스타일이나 기피 색상이어도 바꾸지 않는다.")

    for slot in sorted(parts.replace_slots, key=CATEGORY_ORDER.index):
        if slot == ACCESSORIES:
            texts.append(_accessory_swap_text(parts.original_accessories))
        elif slot in parts.original_slots:
            texts.append(f"{_slot_text(slot)}{_eun_neun(slot)} 다른 후보로 바꾼다.")
        else:
            texts.append(f"{_slot_text(slot)}{_eul_reul(slot)} 1개 더한다.")
    if parts.outer_to_add:
        texts.append(f"{_slot_text('outer')}{_eul_reul('outer')} 1개 더한다.")

    for slot in sorted(parts.freed_slots, key=CATEGORY_ORDER.index):
        if slot == "outer" and parts.outer_required:
            change = "다른 후보로 바꾼다."
        else:
            change = "다른 후보로 바꾸거나 뺄 수 있다."
        texts.append(f"{_slot_text(slot)}{_eun_neun(slot)} 지금 쓸 수 없는 옷이 있어 {change}")
    if parts.accessory_missing and ACCESSORIES not in parts.replace_slots:
        texts.append(
            "악세서리(accessories)는 지금 쓸 수 없는 것이 있어 새 악세서리를 1개까지 넣을 수 있다."
        )
    if ACCESSORIES not in parts.replace_slots:
        texts.append("removed_accessory_id는 null로 둔다.")
    texts.append("지시한 것 말고는 아이템을 더하거나 빼지 않는다.")
    return texts


def _accessory_swap_text(original_accessories: frozenset[str]) -> str:
    if not original_accessories:
        return "악세서리(accessories)를 1개 더한다. removed_accessory_id는 null로 둔다."
    keys = ", ".join(sorted(original_accessories))
    return (
        f"악세서리(accessories)는 원래 악세서리({keys}) 중 1개만 빼고 새 악세서리 1개를 넣는다. "
        "뺀 악세서리의 id를 removed_accessory_id에 적는다."
    )


def _name_texts(intent: RegenerationIntent, *, all_outfits: bool) -> list[str]:
    texts = []
    for slot in CATEGORY_ORDER:
        name = intent.replace_items.get(slot)
        if name is None:
            continue
        if slot == ACCESSORIES and not all_outfits:
            subject = "새 악세서리는"
        else:
            prefix = "모든 세트의 " if all_outfits else ""
            subject = f"{prefix}{_slot_text(slot)}{_eun_neun(slot)}"
        texts.append(f'{subject} 이름이 "{name}"에 가장 가까운 후보로 고른다.')
    return texts


def _warmth_texts(offset: Decimal) -> list[str]:
    if offset == 0:
        return []
    wish, direction = ("가볍게", "높게") if offset > 0 else ("따뜻하게", "낮게")
    shift = f"{abs(offset):.1f}℃ {direction}"
    return [f"회원이 더 {wish} 입기를 원해 위 체감온도를 실제보다 {shift} 적었다."]


# ---------- 1차 검증 덧씌우기 ----------


def make_regeneration_hard_rule_check(
    prompt_input: OutfitPromptInput, plan: RegenerationPlan
) -> HardRuleCheck:
    base = make_hard_rule_check(prompt_input)
    category_by_key = {c.key: c.category_cd for c in prompt_input.candidates}
    replaced = set(plan.replaced_combos)

    def check(
        drafts: Sequence[DraftOutfit], kept_outfits: Sequence[KeptOutfit]
    ) -> list[OutfitValidation]:
        drafts_by_seq = {d.outfit_seq: d for d in drafts}
        results = []
        for result in base(drafts, kept_outfits):
            draft = drafts_by_seq[result.outfit_seq]
            reasons = list(result.reasons)
            if frozenset(draft.item_keys) in replaced:
                reasons.append("바꿔 달라고 한 이전 코디와 아이템 조합이 같다.")
            if plan.parts is not None and draft.outfit_seq == plan.parts.target_seq:
                reasons += check_locked_parts(draft, plan.parts, category_by_key)
                if ACCESSORIES in plan.parts.replace_slots:
                    reasons += check_accessory_swap(draft, plan.parts, category_by_key)
            results.append(
                OutfitValidation(result.outfit_seq, passed=not reasons, reasons=tuple(reasons))
            )
        return results

    return check


def _keys_by_slot(draft: DraftOutfit, category_by_key: Mapping[str, str]) -> dict[str, set[str]]:
    by_slot: dict[str, set[str]] = defaultdict(set)
    for key in draft.item_keys:
        if key in category_by_key:
            by_slot[category_by_key[key]].add(key)
    return by_slot


def check_locked_parts(
    draft: DraftOutfit, parts: PartsPlan, category_by_key: Mapping[str, str]
) -> list[str]:
    by_slot = _keys_by_slot(draft, category_by_key)
    dropped: set[str] = set()
    added: set[str] = set()
    for slot, locked in parts.locked_by_slot.items():
        if slot == ACCESSORIES:
            continue
        dropped |= locked - by_slot.get(slot, set())
        added |= by_slot.get(slot, set()) - locked

    reasons = []
    if ACCESSORIES not in parts.replace_slots:
        locked = parts.locked_by_slot.get(ACCESSORIES, frozenset())
        drafted = by_slot.get(ACCESSORIES, set())
        dropped |= locked - drafted
        new_accessories = drafted - locked
        # 후보에서 빠진 악세서리가 있으면 대신할 악세서리를 1개까지 허용한다 (팀 결정)
        allowed = 1 if parts.accessory_missing else 0
        if len(new_accessories) > allowed:
            if allowed:
                reasons.append(
                    f"새 악세서리는 1개까지만 넣을 수 있다: {', '.join(sorted(new_accessories))}."
                )
            else:
                added |= new_accessories

    if dropped or added:
        changes = [f"{k} 빠짐" for k in sorted(dropped)] + [f"{k} 추가" for k in sorted(added)]
        reasons.insert(0, f"그대로 두기로 한 아이템이 바뀌었다: {', '.join(changes)}.")
    return reasons


def check_accessory_swap(
    draft: DraftOutfit, parts: PartsPlan, category_by_key: Mapping[str, str]
) -> list[str]:
    original = set(parts.original_accessories)
    drafted = _keys_by_slot(draft, category_by_key).get(ACCESSORIES, set())
    removed = original - drafted
    added = drafted - original
    claimed = draft.removed_accessory_id

    if not original:
        reasons = []
        if len(added) != 1:
            reasons.append(f"악세서리를 1개 더해야 하는데 {len(added)}개를 넣었다.")
        if claimed is not None:
            reasons.append("뺀 악세서리가 없으므로 removed_accessory_id는 null이어야 한다.")
        return reasons

    reasons = []
    listed = ", ".join(sorted(original))
    if len(removed) != 1:
        reasons.append(
            f"악세서리는 원래 것({listed}) 중 1개만 빼야 하는데 {len(removed)}개를 뺐다."
        )
    if len(added) != 1:
        reasons.append(f"새 악세서리를 1개 넣어야 하는데 {len(added)}개를 넣었다.")
    if claimed is None:
        reasons.append("뺀 악세서리 id를 removed_accessory_id에 적지 않았다.")
    elif claimed not in original:
        reasons.append(f"removed_accessory_id({_displayable(claimed)})는 원래 악세서리가 아니다.")
    elif len(removed) == 1 and claimed not in removed:
        reasons.append(
            f"removed_accessory_id({claimed})가 실제로 뺀 악세서리({next(iter(removed))})와 다르다."
        )
    return reasons


def _displayable(value: str) -> str:
    return value if DISPLAYABLE_KEY.fullmatch(value) else "형식이 올바르지 않은 id"


# ---------- 추천 사유 덧붙이기 ----------


def append_missing_notes(
    generation: GenerationResult, plan: RegenerationPlan, category_by_key: Mapping[str, str]
) -> GenerationResult:
    parts = plan.parts
    if parts is None or not (parts.missing or parts.outer_to_add):
        return generation
    outfits = [
        replace(o, reason=_with_notes(o, parts, category_by_key))
        if o.outfit_seq == parts.target_seq
        else o
        for o in generation.outfits
    ]
    return replace(generation, outfits=outfits)


def _with_notes(outfit: DraftOutfit, parts: PartsPlan, category_by_key: Mapping[str, str]) -> str:
    by_slot = _keys_by_slot(outfit, category_by_key)
    groups: dict[tuple[MissingCause, bool], list[str]] = defaultdict(list)
    for missing in parts.missing:
        slot = missing.slot_cd
        if slot == ACCESSORIES:
            locked = parts.locked_by_slot.get(ACCESSORIES, frozenset())
            changed = ACCESSORIES not in parts.replace_slots and bool(
                by_slot.get(ACCESSORIES, set()) - locked
            )
        else:
            changed = bool(by_slot.get(slot))
        labels = groups[(missing.cause, changed)]
        if slot not in labels:
            labels.append(slot)

    notes = []
    for cause in _NOTE_PREFIXES:
        for changed in (True, False):
            slots = sorted(groups.get((cause, changed), []), key=CATEGORY_ORDER.index)
            if not slots:
                continue
            labels = _join_labels([CATEGORY_LABELS[s] for s in slots])
            if changed:
                notes.append(f"{_NOTE_PREFIXES[cause]} {labels}도 함께 바꿨어요.")
            else:
                notes.append(f"{_NOTE_PREFIXES[cause]} {labels}{_eun_neun(labels)} 뺐어요.")
    if parts.outer_to_add and by_slot.get("outer"):
        notes.append(_OUTER_ADDED_NOTES[parts.outer_to_add])
    return " ".join([outfit.reason.rstrip(), *notes])


def _has_final_consonant(word: str) -> bool:
    code = ord(word[-1]) - 0xAC00
    return 0 <= code < 11172 and code % 28 != 0


def _eun_neun(word: str) -> str:
    return "은" if _has_final_consonant(_spoken(word)) else "는"


def _eul_reul(word: str) -> str:
    return "을" if _has_final_consonant(_spoken(word)) else "를"


def _spoken(word: str) -> str:
    return CATEGORY_LABELS.get(word, word)


def _join_labels(labels: Sequence[str]) -> str:
    if len(labels) == 1:
        return labels[0]
    head = ", ".join(labels[:-1])
    particle = "과" if _has_final_consonant(labels[-2]) else "와"
    return f"{head}{particle} {labels[-1]}"


# ---------- 생성 ----------


async def regenerate_outfits(
    ctx: RegenerationContext, llm: LLMClient, *, rng: random.Random | None = None
) -> RegenerationOutcome:
    settings = get_settings()
    context = ctx.context
    session_id = context.recommendation_session_id
    current = ctx.request.parsed_intent
    offset = feels_like_offset(ctx.intents, settings)

    adjusted = replace(context, weather=apply_feels_like_offset(context.weather, offset))
    supplement = await collect_essential_candidates(adjusted, filter_clothing(adjusted))
    candidates = [to_candidate_item(c) for c in supplement.candidates]
    candidate_keys = {c.key for c in candidates}

    keys_before_offset = None
    outer_cause: OuterCause = "weather"
    outer_required = supplement.outer_requirement == "required"
    has_parts = ctx.request.target_slot_cd is not None or bool(current.replace_items)
    if offset and ctx.request.target_scope_cd == "single" and has_parts:
        before = await collect_essential_candidates(context, filter_clothing(context))
        keys_before_offset = frozenset(c.key for c in before.candidates)
        if offset < 0 and outer_required and before.outer_requirement != "required":
            outer_cause = "warmer"
    classify = make_missing_classifier(offset, keys_before_offset, candidate_keys)
    plan = plan_regeneration(
        ctx, candidates, classify, outer_required=outer_required, outer_cause=outer_cause
    )

    candidates_by_key = {c.key: c for c in candidates}
    if plan.removed_keys:
        candidates = [c for c in candidates if c.key not in plan.removed_keys]

    async with AsyncSessionLocal() as db:
        preferences = await load_preferences(
            db, context.member_id, rng or random.Random(session_id), ctx.intents
        )
    locked_avoided = plan.parts is not None and locked_has_avoided(
        plan.parts,
        candidates_by_key,
        preferences.style_result.avoided,
        preferences.color_result.avoided,
    )
    prompt_input = replace(
        build_prompt_input(adjusted, supplement, preferences, _outfit_count(plan)),
        candidates=candidates,
        exploration_style=choose_exploration_style(
            plan, current, preferences.exploration_style, locked_avoided=locked_avoided
        ),
        kept_outfits=plan.kept,
        regeneration_instructions=tuple(
            build_regeneration_instructions(plan, current, offset, locked_avoided=locked_avoided)
        ),
    )

    if plan.parts is not None and plan.parts.no_alternative_slots:
        logger.info(
            "regeneration no alternative",
            extra={
                "event": Event.REGENERATION_NO_ALTERNATIVE,
                "recommendation_session_id": session_id,
                "regeneration_request_id": ctx.request.regeneration_request_id,
                "slots": list(plan.parts.no_alternative_slots),
            },
        )
        return RegenerationOutcome(_empty_generation(), supplement, prompt_input)

    generation = await generate_outfits(
        llm,
        prompt_input,
        hard_rule=make_regeneration_hard_rule_check(prompt_input, plan),
        review=make_llm_reviewer(llm, prompt_input),
        fallback=_no_fallback,
        session_id=session_id,
    )
    category_by_key = {c.key: c.category_cd for c in prompt_input.candidates}
    generation = _clear_unrequested_removed_ids(generation, plan)
    generation = append_missing_notes(generation, plan, category_by_key)
    _log_removed_accessories(generation, plan, session_id)
    _log_exploration_dropped(generation, prompt_input, session_id, ctx.request)
    return RegenerationOutcome(generation, supplement, prompt_input)


def _outfit_count(plan: RegenerationPlan) -> int:
    return MAX_OUTFITS if plan.scope == "all" else 1


def _no_fallback(seqs: Sequence[int], existing: Sequence[Sequence[str]]) -> list[DraftOutfit]:
    return []


def _empty_generation() -> GenerationResult:
    return GenerationResult(
        outfits=[],
        rounds=0,
        hard_rule_retries=0,
        reviewer_retries=0,
        shortfall_retries=0,
        fallback_count=0,
    )


def _clear_unrequested_removed_ids(
    generation: GenerationResult, plan: RegenerationPlan
) -> GenerationResult:
    parts = plan.parts
    swap_seq = parts.target_seq if parts and ACCESSORIES in parts.replace_slots else None
    outfits = [
        o if o.outfit_seq == swap_seq else replace(o, removed_accessory_id=None)
        for o in generation.outfits
    ]
    return replace(generation, outfits=outfits)


def _log_removed_accessories(
    generation: GenerationResult, plan: RegenerationPlan, session_id: int
) -> None:
    if plan.parts is None or ACCESSORIES not in plan.parts.replace_slots:
        return
    for outfit in generation.outfits:
        if outfit.outfit_seq == plan.parts.target_seq and outfit.removed_accessory_id:
            logger.info(
                "regeneration accessory removed",
                extra={
                    "event": Event.REGENERATION_ACCESSORY_REMOVED,
                    "recommendation_session_id": session_id,
                    "outfit_seq": outfit.outfit_seq,
                    "removed_accessory_id": outfit.removed_accessory_id,
                },
            )


def _log_exploration_dropped(
    generation: GenerationResult,
    prompt_input: OutfitPromptInput,
    session_id: int,
    request: RegenerationRequestRow,
) -> None:
    if prompt_input.exploration_style is None or not generation.outfits:
        return
    if _generator_drops_exploration(prompt_input):
        return
    if any(o.outfit_type == "exploratory" for o in generation.outfits):
        return
    logger.info(
        "regeneration exploration dropped",
        extra={
            "event": Event.REGENERATION_EXPLORATION_DROPPED,
            "recommendation_session_id": session_id,
            "regeneration_request_id": request.regeneration_request_id,
            "outfit_seqs": [o.outfit_seq for o in generation.outfits],
        },
    )


def _generator_drops_exploration(prompt_input: OutfitPromptInput) -> bool:
    if any(k.outfit_type == "preferred" for k in prompt_input.kept_outfits):
        return False
    if prompt_input.outfit_count <= 1:
        return True
    possible = count_possible_combos(prompt_input.candidates, prompt_input.is_outer_required)
    return not prompt_input.kept_outfits and possible <= 1
