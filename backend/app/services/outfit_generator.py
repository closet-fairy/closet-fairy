"""코디 생성·부분 재생성 루프 + 폴백 (REC-15).

생성 → 1차 검증(규칙) → 2차 검증(AI 리뷰어)을 돌리고, 통과한 세트는 고정한 채
실패한 수만큼만 다시 만든다(FR-REC-17). 실패 사유는 다음 생성 프롬프트의
failure_reasons 슬롯에 넣는다. 검증 단계별 재생성 한도를 넘거나 LLM 호출이 실패하면
남은 자리를 기본 코디(폴백)로 채운다.

1차 검증·2차 검증·폴백은 함수로 주입받는다. 1차 검증은 make_hard_rule_check()로 만들고,
재추천(FR-REF)도 kept_outfits만 바꿔 같은 함수를 쓴다.
"""

import logging
from collections.abc import Awaitable, Callable, Sequence
from dataclasses import dataclass, replace
from itertools import product

from app.core.config import get_settings
from app.core.logging import Event
from app.services.hard_rule import validate_hard_rules
from app.services.llm import LLMCallConfig, LLMClient, LLMError
from app.services.outfit_validation import OutfitValidation, to_failure_reasons
from app.services.prompt.outfit_generation import (
    CandidateItem,
    FailureReason,
    KeptOutfit,
    OutfitGenerationOutput,
    OutfitPromptInput,
    OutfitType,
    assemble_outfit_generation_prompt,
)
from app.services.prompt.outfit_review import OutfitReviewInput, ReviewTarget
from app.services.reviewer import review_outfits

logger = logging.getLogger(__name__)

CALL_NAME = "outfit_generation"
MAX_OUTFITS = 4
FALLBACK_REASON = "조건에 맞는 코디를 만들지 못해 기본 조합으로 구성했어요."


@dataclass(frozen=True)
class DraftOutfit:
    """생성(또는 폴백)된 코디 한 세트. item_keys는 candidate_key() 형식("o1042", "e31")."""

    outfit_seq: int
    outfit_type: OutfitType
    item_keys: tuple[str, ...]
    reason: str
    is_fallback: bool = False


@dataclass(frozen=True)
class GenerationResult:
    outfits: list[DraftOutfit]
    rounds: int
    hard_rule_retries: int
    reviewer_retries: int
    shortfall_retries: int
    fallback_count: int


HardRuleCheck = Callable[[Sequence[DraftOutfit], Sequence[KeptOutfit]], list[OutfitValidation]]
ReviewCheck = Callable[[Sequence[DraftOutfit]], Awaitable[list[OutfitValidation]]]
FallbackBuilder = Callable[[Sequence[int], Sequence[Sequence[str]]], list[DraftOutfit]]


async def generate_outfits(
    llm: LLMClient,
    prompt_input: OutfitPromptInput,
    *,
    hard_rule: HardRuleCheck,
    review: ReviewCheck,
    fallback: FallbackBuilder,
    max_retry_per_stage: int | None = None,
    session_id: int | None = None,
) -> GenerationResult:
    """prompt_input.outfit_count만큼 세트를 채운다.

    prompt_input.kept_outfits(재추천에서 유지하는 세트)는 고정으로 보고 프롬프트와
    1차 검증(같은 조합 검사)에 넘기며 결과에는 넣지 않는다. failure_reasons는 이 함수가 채운다.
    """
    if max_retry_per_stage is None:
        max_retry_per_stage = get_settings().MAX_RETRY_PER_VALIDATION_STAGE
    target = prompt_input.outfit_count
    kept = tuple(prompt_input.kept_outfits)
    accepted: list[DraftOutfit] = []
    failure_reasons: list[FailureReason] = []
    hard_retries = reviewer_retries = shortfall_retries = rounds = 0
    log_extra = {"recommendation_session_id": session_id}

    while len(accepted) < target:
        seqs = _free_seqs(kept, accepted)[: target - len(accepted)]
        data = replace(
            prompt_input,
            outfit_count=len(seqs),
            kept_outfits=kept + tuple(_as_kept(a) for a in accepted),
            failure_reasons=tuple(failure_reasons),
            exploration_style=_exploration_style(prompt_input, kept, accepted),
        )
        rounds += 1
        try:
            drafts = await _generate(llm, data, seqs)
        except LLMError:
            logger.warning("outfit generation call failed", exc_info=True, extra=log_extra)
            break

        missing_count = len(seqs) - len(drafts)
        hard_failed = [v for v in hard_rule(drafts, data.kept_outfits) if not v.passed]
        hard_failed_seqs = {v.outfit_seq for v in hard_failed}
        survivors = [d for d in drafts if d.outfit_seq not in hard_failed_seqs]

        try:
            review_failed = (
                [v for v in await review(survivors) if not v.passed] if survivors else []
            )
        except LLMError:
            # 리뷰어 장애로 규칙 검증까지 통과한 세트를 버리지는 않는다
            logger.warning("outfit review call failed", exc_info=True, extra=log_extra)
            review_failed = []
        review_failed_seqs = {v.outfit_seq for v in review_failed}
        accepted += [d for d in survivors if d.outfit_seq not in review_failed_seqs]

        _log_failures(Event.HARD_RULE_FAIL, "hard_rule", hard_failed, drafts, rounds, log_extra)
        _log_failures(Event.REVIEWER_FAIL, "reviewer", review_failed, drafts, rounds, log_extra)

        if len(accepted) >= target:
            break
        if hard_failed:
            if hard_retries >= max_retry_per_stage:
                break
            hard_retries += 1
        if review_failed:
            if reviewer_retries >= max_retry_per_stage:
                break
            reviewer_retries += 1
        if missing_count:
            if shortfall_retries >= max_retry_per_stage:
                break
            shortfall_retries += 1
        failure_reasons = to_failure_reasons(hard_failed + review_failed)
        logger.info(
            "outfit regenerate",
            extra={
                **log_extra,
                "event": Event.RECOMMEND_REGENERATE,
                "round": rounds,
                "regenerate_count": target - len(accepted),
                "missing_count": missing_count,
            },
        )

    fallback_outfits: list[DraftOutfit] = []
    remaining = target - len(accepted)
    if remaining > 0:
        seqs = _free_seqs(kept, accepted)[:remaining]
        existing = [k.item_keys for k in kept] + [a.item_keys for a in accepted]
        fallback_outfits = fallback(seqs, existing)
        logger.info(
            "outfit fallback",
            extra={
                **log_extra,
                "event": Event.RECOMMEND_FALLBACK,
                "requested": remaining,
                "built": len(fallback_outfits),
            },
        )

    return GenerationResult(
        outfits=sorted(accepted + fallback_outfits, key=lambda o: o.outfit_seq),
        rounds=rounds,
        hard_rule_retries=hard_retries,
        reviewer_retries=reviewer_retries,
        shortfall_retries=shortfall_retries,
        fallback_count=len(fallback_outfits),
    )


async def _generate(
    llm: LLMClient, data: OutfitPromptInput, seqs: Sequence[int]
) -> list[DraftOutfit]:
    prompt = assemble_outfit_generation_prompt(data)
    output = await llm.call_structured(
        LLMCallConfig(call_name=CALL_NAME, prompt_version=prompt.prompt_version),
        system=prompt.system,
        messages=[{"role": "user", "content": prompt.user}],
        output_model=OutfitGenerationOutput,
    )
    drafts = [
        DraftOutfit(
            outfit_seq=seq,
            outfit_type=generated.outfit_type,
            item_keys=tuple(generated.item_ids),
            reason=generated.reason,
        )
        for seq, generated in zip(seqs, output.outfits, strict=False)
    ]
    return _limit_exploratory(drafts, exploration_requested=data.exploration_style is not None)


def _limit_exploratory(
    drafts: Sequence[DraftOutfit], *, exploration_requested: bool
) -> list[DraftOutfit]:
    limited: list[DraftOutfit] = []
    exploratory_taken = not exploration_requested
    for draft in drafts:
        if draft.outfit_type == "exploratory":
            if exploratory_taken:
                draft = replace(draft, outfit_type="preferred")
            exploratory_taken = True
        limited.append(draft)
    return limited


def _free_seqs(kept: Sequence[KeptOutfit], accepted: Sequence[DraftOutfit]) -> list[int]:
    used = {k.outfit_seq for k in kept} | {a.outfit_seq for a in accepted}
    return [seq for seq in range(1, MAX_OUTFITS + 1) if seq not in used]


def _as_kept(outfit: DraftOutfit) -> KeptOutfit:
    return KeptOutfit(outfit.outfit_seq, list(outfit.item_keys), outfit.outfit_type)


def _exploration_style(
    prompt_input: OutfitPromptInput, kept: Sequence[KeptOutfit], accepted: Sequence[DraftOutfit]
) -> str | None:
    # 탐색 코디는 한 벌뿐이라, 이미 통과·유지된 탐색 세트가 있으면 더 요청하지 않는다
    if any(k.outfit_type == "exploratory" for k in kept):
        return None
    if any(a.outfit_type == "exploratory" for a in accepted):
        return None
    return prompt_input.exploration_style


def _log_failures(
    event: str,
    stage_cd: str,
    failures: Sequence[OutfitValidation],
    drafts: Sequence[DraftOutfit],
    round_no: int,
    log_extra: dict,
) -> None:
    # 실패한 코디는 저장하지 않고 로그로만 남긴다 (FR-REC-17)
    items_by_seq = {d.outfit_seq: list(d.item_keys) for d in drafts}
    for failure in failures:
        logger.info(
            "outfit validation failed",
            extra={
                **log_extra,
                "event": event,
                "validation_stage_cd": stage_cd,
                "round": round_no,
                "outfit_seq": failure.outfit_seq,
                "item_keys": items_by_seq.get(failure.outfit_seq, []),
                "reasons": list(failure.reasons),
            },
        )


# ---------- 기본 주입 함수 ----------


def make_hard_rule_check(prompt_input: OutfitPromptInput) -> HardRuleCheck:
    def check(
        drafts: Sequence[DraftOutfit], kept_outfits: Sequence[KeptOutfit]
    ) -> list[OutfitValidation]:
        return validate_hard_rules(
            drafts,
            kept_outfits,
            candidates=prompt_input.candidates,
            is_outer_required=prompt_input.is_outer_required,
            season_cd=prompt_input.season_cd,
            avoided_styles=prompt_input.style_result.avoided,
            avoided_colors=prompt_input.color_result.avoided,
        )

    return check


def make_llm_reviewer(llm: LLMClient, prompt_input: OutfitPromptInput) -> ReviewCheck:
    """2차 검증(REC-14) 리뷰어를 생성 루프 형태로 감싼다. 프롬프트 입력은 생성과 같은 값을 쓴다."""

    async def review(drafts: Sequence[DraftOutfit]) -> list[OutfitValidation]:
        return await review_outfits(
            llm,
            OutfitReviewInput(
                weather=prompt_input.weather,
                going_out_start_at=prompt_input.going_out_start_at,
                going_out_end_at=prompt_input.going_out_end_at,
                season_cd=prompt_input.season_cd,
                tpo_cd=prompt_input.tpo_cd,
                tpo_text=prompt_input.tpo_text,
                temperature_sensitivity_cd=prompt_input.temperature_sensitivity_cd,
                gender_cd=prompt_input.gender_cd,
                is_outer_required=prompt_input.is_outer_required,
                candidates=prompt_input.candidates,
                outfits=[ReviewTarget(d.outfit_seq, list(d.item_keys)) for d in drafts],
            ),
        )

    return review


def make_basic_outfit_fallback(
    candidates: Sequence[CandidateItem], is_outer_required: bool
) -> FallbackBuilder:
    """후보 목록으로 기본 코디(상의·하의·신발, 필요하면 아우터)를 조합하는 폴백.

    에센셜을 먼저 쓰고(FR-REC-17), 모자라면 보유 의류로 채운다. 후보 목록 안의 옷만
    쓰므로 없는 옷이 섞일 일이 없다.
    """

    def build(seqs: Sequence[int], existing: Sequence[Sequence[str]]) -> list[DraftOutfit]:
        taken = {frozenset(keys) for keys in existing}
        combos = compose_basic_outfits(candidates, is_outer_required, taken, len(seqs))
        return [
            DraftOutfit(seq, "preferred", combo, FALLBACK_REASON, is_fallback=True)
            for seq, combo in zip(seqs, combos, strict=False)
        ]

    return build


def compose_basic_outfits(
    candidates: Sequence[CandidateItem],
    is_outer_required: bool,
    taken: set[frozenset[str]],
    count: int,
) -> list[tuple[str, ...]]:
    """기존 세트와 겹치지 않는 기본 조합을 최대 count개 만든다. 순수 함수."""
    taken = set(taken)

    def by_category(category_cd: str) -> list[str]:
        items = [c for c in candidates if c.category_cd == category_cd]
        items.sort(key=lambda c: c.source != "essential")
        return [c.key for c in items]

    tops, bottoms, shoes = by_category("top"), by_category("bottom"), by_category("shoes")
    outers = by_category("outer") if is_outer_required else []
    if not (tops and bottoms and shoes) or (is_outer_required and not outers):
        return []

    longest = max(len(tops), len(bottoms), len(shoes))
    diagonal = [
        (tops[i % len(tops)], bottoms[i % len(bottoms)], shoes[i % len(shoes)])
        for i in range(longest)
    ]
    in_diagonal = set(diagonal)
    ordered = diagonal + [c for c in product(tops, bottoms, shoes) if c not in in_diagonal]

    combos: list[tuple[str, ...]] = []
    for i, (top, bottom, shoe) in enumerate(ordered):
        combo = ((outers[i % len(outers)],) if outers else ()) + (top, bottom, shoe)
        if frozenset(combo) in taken:
            continue
        taken.add(frozenset(combo))
        combos.append(combo)
        if len(combos) == count:
            break
    return combos
