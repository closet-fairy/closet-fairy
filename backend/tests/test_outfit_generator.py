"""REC-15 생성·부분 재생성 루프 테스트. LLM·검증 함수는 모두 가짜로 바꿔 끼운다."""

from collections.abc import Sequence
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.core.config import get_settings
from app.services import outfit_generator
from app.services.llm import LLMClient, LLMTimeoutError
from app.services.outfit_generator import (
    FALLBACK_REASON,
    DraftOutfit,
    compose_basic_outfits,
    count_possible_combos,
    generate_outfits,
    make_basic_outfit_fallback,
    make_hard_rule_check,
    make_llm_reviewer,
)
from app.services.outfit_validation import OutfitValidation
from app.services.prompt.outfit_generation import (
    CandidateItem,
    KeptOutfit,
    OutfitGenerationOutput,
)
from tests.test_outfit_generation_prompt import CANDIDATES, make_input

GOOD = ["o2001", "o3001", "o4001"]
BAD = ["o9999"]


def generation(*outfits: tuple[str, list[str]]) -> OutfitGenerationOutput:
    return OutfitGenerationOutput.model_validate(
        {"outfits": [{"outfit_type": t, "item_ids": ids, "reason": "이유"} for t, ids in outfits]}
    )


def fake_llm(*outputs) -> MagicMock:
    llm = MagicMock(spec=LLMClient)
    llm.call_structured = AsyncMock(side_effect=list(outputs))
    return llm


def rule_rejects(bad_key: str):
    def check(
        drafts: Sequence[DraftOutfit], kept_outfits: Sequence[KeptOutfit]
    ) -> list[OutfitValidation]:
        return [
            OutfitValidation(d.outfit_seq, passed=False, reasons=("없는 옷",))
            if bad_key in d.item_keys
            else OutfitValidation(d.outfit_seq, passed=True)
            for d in drafts
        ]

    return check


def all_pass_rule(
    drafts: Sequence[DraftOutfit], kept_outfits: Sequence[KeptOutfit]
) -> list[OutfitValidation]:
    return [OutfitValidation(d.outfit_seq, passed=True) for d in drafts]


def reviewer(*fail_keys: str) -> AsyncMock:
    async def review(drafts: Sequence[DraftOutfit]) -> list[OutfitValidation]:
        return [
            OutfitValidation(d.outfit_seq, passed=False, reasons=("TPO에 안 맞음",))
            if any(k in d.item_keys for k in fail_keys)
            else OutfitValidation(d.outfit_seq, passed=True)
            for d in drafts
        ]

    return AsyncMock(side_effect=review)


def no_fallback(seqs, existing) -> list[DraftOutfit]:
    return []


def recording_fallback(calls: list):
    def build(seqs, existing) -> list[DraftOutfit]:
        calls.append(list(seqs))
        return [DraftOutfit(s, "preferred", ("e1", "e2", "e3"), "기본", True) for s in seqs]

    return build


def prompt_data(llm: MagicMock, call_index: int) -> str:
    return llm.call_structured.call_args_list[call_index].kwargs["messages"][0]["content"]


async def run(llm, *, hard_rule=all_pass_rule, review=None, fallback=no_fallback, **input_kw):
    return await generate_outfits(
        llm,
        make_input(**input_kw),
        hard_rule=hard_rule,
        review=review or reviewer(),
        fallback=fallback,
        max_retry_per_stage=2,
    )


# ---------- 정상 ----------


async def test_all_pass_in_one_round():
    llm = fake_llm(
        generation(
            ("preferred", GOOD), ("preferred", GOOD), ("preferred", GOOD), ("exploratory", GOOD)
        )
    )

    result = await run(llm)

    assert [o.outfit_seq for o in result.outfits] == [1, 2, 3, 4]
    assert result.rounds == 1
    assert result.fallback_count == 0


# ---------- 부분 재생성 ----------


async def test_only_hard_rule_failed_outfit_is_regenerated():
    llm = fake_llm(
        generation(
            ("preferred", GOOD), ("preferred", BAD), ("preferred", GOOD), ("exploratory", GOOD)
        ),
        generation(("preferred", GOOD)),
    )

    result = await run(llm, hard_rule=rule_rejects("o9999"))

    assert len(result.outfits) == 4
    assert result.rounds == 2
    assert result.hard_rule_retries == 1
    second = prompt_data(llm, 1)
    assert "## 유지 중인 세트" in second
    assert "세트 2: 없는 옷" in second
    assert "코디 세트 1벌을 만든다" in second


async def test_reviewer_failure_is_regenerated_with_reason():
    llm = fake_llm(
        generation(
            ("preferred", GOOD), ("preferred", GOOD), ("preferred", ["e7"]), ("exploratory", GOOD)
        ),
        generation(("preferred", GOOD)),
    )

    result = await run(llm, review=reviewer("e7"))

    assert len(result.outfits) == 4
    assert result.reviewer_retries == 1
    assert "세트 3: TPO에 안 맞음" in prompt_data(llm, 1)


async def test_hard_rule_failed_outfit_is_not_sent_to_reviewer():
    review = reviewer()
    llm = fake_llm(
        generation(
            ("preferred", GOOD), ("preferred", BAD), ("preferred", GOOD), ("exploratory", GOOD)
        ),
        generation(("preferred", GOOD)),
    )

    await run(llm, hard_rule=rule_rejects("o9999"), review=review)

    first_review = review.call_args_list[0].args[0]
    assert [d.outfit_seq for d in first_review] == [1, 3, 4]


async def test_exploration_is_not_requested_again_after_exploratory_passed():
    llm = fake_llm(
        generation(
            ("preferred", BAD), ("preferred", GOOD), ("preferred", GOOD), ("exploratory", GOOD)
        ),
        generation(("preferred", GOOD)),
    )

    await run(llm, hard_rule=rule_rejects("o9999"))

    assert "## 탐색 스타일" not in prompt_data(llm, 1)


async def test_missing_outfits_from_llm_are_regenerated():
    llm = fake_llm(
        generation(("preferred", GOOD), ("preferred", GOOD), ("exploratory", GOOD)),
        generation(("preferred", GOOD)),
    )

    result = await run(llm)

    assert len(result.outfits) == 4
    assert result.rounds == 2
    assert result.shortfall_retries == 1
    assert result.hard_rule_retries == 0
    assert "## 직전 생성의 검증 실패 사유" not in prompt_data(llm, 1)


async def test_repeated_shortfall_stops_at_limit_then_fallback():
    short = generation(("preferred", GOOD), ("preferred", GOOD), ("exploratory", GOOD))
    llm = fake_llm(short, generation(), generation())
    calls: list = []

    result = await run(llm, fallback=recording_fallback(calls))

    assert result.rounds == 3
    assert result.shortfall_retries == 2
    assert calls == [[4]]


async def test_extra_outfits_from_llm_are_ignored():
    llm = fake_llm(
        generation(*[("preferred", GOOD)] * 3, ("exploratory", GOOD), ("preferred", GOOD))
    )

    result = await run(llm)

    assert len(result.outfits) == 4


# ---------- 한도 · 폴백 ----------


async def test_hard_rule_retry_limit_then_fallback():
    always_bad = generation(
        ("preferred", BAD), ("preferred", GOOD), ("preferred", GOOD), ("exploratory", GOOD)
    )
    llm = fake_llm(always_bad, generation(("preferred", BAD)), generation(("preferred", BAD)))
    calls: list = []

    result = await run(llm, hard_rule=rule_rejects("o9999"), fallback=recording_fallback(calls))

    assert result.rounds == 3
    assert result.hard_rule_retries == 2
    assert calls == [[1]]
    assert result.fallback_count == 1
    assert len(result.outfits) == 4


async def test_reviewer_retry_limit_is_counted_separately_from_hard_rule():
    llm = fake_llm(
        generation(
            ("preferred", BAD), ("preferred", ["e7"]), ("preferred", GOOD), ("exploratory", GOOD)
        ),
        generation(("preferred", BAD), ("preferred", ["e7"])),
        generation(("preferred", BAD), ("preferred", ["e7"])),
    )
    calls: list = []

    result = await run(
        llm,
        hard_rule=rule_rejects("o9999"),
        review=reviewer("e7"),
        fallback=recording_fallback(calls),
    )

    assert result.hard_rule_retries == 2
    assert result.reviewer_retries == 2
    assert calls == [[1, 2]]


async def test_llm_error_falls_back_for_all_remaining():
    llm = fake_llm(LLMTimeoutError("timeout"))
    calls: list = []

    result = await run(llm, fallback=recording_fallback(calls))

    assert calls == [[1, 2, 3, 4]]
    assert all(o.is_fallback for o in result.outfits)


async def test_reviewer_error_keeps_rule_passed_outfits():
    llm = fake_llm(generation(*[("preferred", GOOD)] * 3, ("exploratory", GOOD)))
    review = AsyncMock(side_effect=LLMTimeoutError("timeout"))

    result = await run(llm, review=review)

    assert len(result.outfits) == 4
    assert result.fallback_count == 0


# ---------- 재추천(유지 세트) ----------


async def test_kept_outfits_are_not_regenerated_or_returned():
    kept = (KeptOutfit(1, GOOD, "preferred"), KeptOutfit(3, GOOD, "exploratory"))
    llm = fake_llm(generation(("preferred", GOOD), ("preferred", GOOD)))

    result = await run(llm, outfit_count=2, kept_outfits=kept, exploration_style=None)

    assert [o.outfit_seq for o in result.outfits] == [2, 4]


async def test_fallback_does_not_repeat_kept_outfit():
    kept = (KeptOutfit(1, ["e1", "e2", "e3"], "preferred"),)
    llm = fake_llm(LLMTimeoutError("timeout"))

    result = await generate_outfits(
        llm,
        make_input(outfit_count=1, kept_outfits=kept, exploration_style=None),
        hard_rule=all_pass_rule,
        review=reviewer(),
        fallback=make_basic_outfit_fallback(POOL, is_outer_required=False),
        max_retry_per_stage=2,
    )

    assert len(result.outfits) == 1
    assert frozenset(result.outfits[0].item_keys) != frozenset({"e1", "e2", "e3"})


# ---------- 탐색 코디 수 제한 ----------


async def test_extra_exploratory_in_one_response_is_relabeled_preferred():
    llm = fake_llm(generation(*[("exploratory", GOOD)] * 2, *[("preferred", GOOD)] * 2))

    result = await run(llm)

    assert [o.outfit_type for o in result.outfits].count("exploratory") == 1


async def test_exploratory_after_exploratory_passed_does_not_break_next_round():
    llm = fake_llm(
        generation(
            ("preferred", BAD), ("preferred", GOOD), ("preferred", GOOD), ("exploratory", GOOD)
        ),
        generation(("exploratory", GOOD)),
    )

    result = await run(llm, hard_rule=rule_rejects("o9999"))

    assert len(result.outfits) == 4
    assert [o.outfit_type for o in result.outfits].count("exploratory") == 1


async def test_exploratory_is_relabeled_when_exploration_not_requested():
    llm = fake_llm(generation(*[("preferred", GOOD)] * 3, ("exploratory", GOOD)))

    result = await run(llm, exploration_style=None)

    assert all(o.outfit_type == "preferred" for o in result.outfits)


async def test_retry_limit_defaults_to_setting():
    bad = generation(("preferred", BAD), *[("preferred", GOOD)] * 2, ("exploratory", GOOD))
    llm = fake_llm(bad, *[generation(("preferred", BAD))] * 5)

    result = await generate_outfits(
        llm,
        make_input(),
        hard_rule=rule_rejects("o9999"),
        review=reviewer(),
        fallback=no_fallback,
    )

    assert result.hard_rule_retries == get_settings().MAX_RETRY_PER_VALIDATION_STAGE


# ---------- 1차 검증 연결 ----------

OTHER = ["o2002", "e12", "e21"]


def test_hard_rule_check_passes_prompt_input_fields(monkeypatch):
    captured = {}

    def fake_validate_hard_rules(drafts, kept_outfits, **kwargs):
        captured.update(drafts=drafts, kept_outfits=kept_outfits, **kwargs)
        return [OutfitValidation(1, passed=True)]

    monkeypatch.setattr(outfit_generator, "validate_hard_rules", fake_validate_hard_rules)
    prompt_input = make_input()
    drafts = [DraftOutfit(1, "preferred", tuple(GOOD), "이유")]
    kept = [KeptOutfit(2, OTHER, "preferred")]

    make_hard_rule_check(prompt_input)(drafts, kept)

    assert captured == {
        "drafts": drafts,
        "kept_outfits": kept,
        "candidates": prompt_input.candidates,
        "is_outer_required": prompt_input.is_outer_required,
        "season_cd": prompt_input.season_cd,
        "avoided_styles": prompt_input.style_result.avoided,
        "avoided_colors": prompt_input.color_result.avoided,
    }


async def test_hard_rule_rejects_combination_passed_in_earlier_round():
    prompt_input = make_input(outfit_count=2, exploration_style=None, is_outer_required=False)
    llm = fake_llm(
        generation(("preferred", GOOD), ("preferred", BAD)),
        generation(("preferred", list(reversed(GOOD)))),
        generation(("preferred", OTHER)),
    )

    result = await generate_outfits(
        llm,
        prompt_input,
        hard_rule=make_hard_rule_check(prompt_input),
        review=reviewer(),
        fallback=no_fallback,
        max_retry_per_stage=2,
    )

    assert [list(o.item_keys) for o in result.outfits] == [GOOD, OTHER]
    assert result.hard_rule_retries == 2
    assert "- 세트 2: 이미 정해진 세트 1과 아이템 조합이 같다." in prompt_data(llm, 2)


async def test_hard_rule_rejects_combination_of_kept_outfit():
    prompt_input = make_input(
        outfit_count=1,
        exploration_style=None,
        is_outer_required=False,
        kept_outfits=(KeptOutfit(1, GOOD, "preferred"),),
    )
    llm = fake_llm(generation(("preferred", GOOD)), generation(("preferred", OTHER)))

    result = await generate_outfits(
        llm,
        prompt_input,
        hard_rule=make_hard_rule_check(prompt_input),
        review=reviewer(),
        fallback=no_fallback,
        max_retry_per_stage=2,
    )

    assert [(o.outfit_seq, list(o.item_keys)) for o in result.outfits] == [(2, OTHER)]
    assert "- 세트 2: 이미 정해진 세트 1과 아이템 조합이 같다." in prompt_data(llm, 1)


# ---------- 2차 검증 연결 ----------


async def test_llm_reviewer_passes_prompt_input_and_outfits(monkeypatch):
    captured = {}

    async def fake_review_outfits(llm, data):
        captured["data"] = data
        return [OutfitValidation(1, passed=True)]

    monkeypatch.setattr(outfit_generator, "review_outfits", fake_review_outfits)
    prompt_input = make_input()
    llm = MagicMock(spec=LLMClient)

    await make_llm_reviewer(llm, prompt_input)([DraftOutfit(1, "preferred", tuple(GOOD), "이유")])

    data = captured["data"]
    for field in (
        "weather",
        "going_out_start_at",
        "going_out_end_at",
        "season_cd",
        "tpo_cd",
        "tpo_text",
        "temperature_sensitivity_cd",
        "gender_cd",
        "is_outer_required",
        "candidates",
    ):
        assert getattr(data, field) == getattr(prompt_input, field), field
    assert [(o.outfit_seq, list(o.item_keys)) for o in data.outfits] == [(1, GOOD)]


# ---------- 기본 코디 조합 ----------

POOL = (
    CandidateItem("essential", 1, "top", "흰 티", "white", ["casual"], "thin"),
    CandidateItem("owned", 10, "top", "셔츠", "white", ["classic"], "thin"),
    CandidateItem("essential", 2, "bottom", "슬랙스", "black", ["minimal"], "medium"),
    CandidateItem("owned", 20, "bottom", "청바지", "blue", ["casual"], "medium"),
    CandidateItem("essential", 3, "shoes", "스니커즈", "white", ["casual"], None),
    CandidateItem("essential", 4, "outer", "가디건", "gray", ["casual"], "medium"),
)


def test_compose_uses_essentials_first_and_varies_items():
    combos = compose_basic_outfits(POOL, is_outer_required=False, taken=set(), count=2)

    assert combos[0] == ("e1", "e2", "e3")
    assert combos[1] == ("o10", "o20", "e3")


def test_compose_includes_outer_when_required():
    combos = compose_basic_outfits(POOL, is_outer_required=True, taken=set(), count=1)

    assert combos == [("e4", "e1", "e2", "e3")]


def test_compose_skips_combinations_already_taken():
    combos = compose_basic_outfits(
        POOL, is_outer_required=False, taken={frozenset({"e1", "e2", "e3"})}, count=1
    )

    assert combos == [("o10", "o20", "e3")]


def test_compose_does_not_modify_taken_argument():
    taken = {frozenset({"e1", "e2", "e3"})}

    compose_basic_outfits(POOL, is_outer_required=False, taken=taken, count=2)

    assert taken == {frozenset({"e1", "e2", "e3"})}


def test_compose_returns_empty_without_required_category():
    no_shoes = [c for c in POOL if c.category_cd != "shoes"]

    assert compose_basic_outfits(no_shoes, is_outer_required=False, taken=set(), count=3) == []


def test_fallback_builder_marks_outfits_as_fallback():
    build = make_basic_outfit_fallback(POOL, is_outer_required=False)

    outfits = build([2, 3], [("e1", "e2", "e3")])

    assert [o.outfit_seq for o in outfits] == [2, 3]
    assert all(o.is_fallback and o.reason == FALLBACK_REASON for o in outfits)
    assert frozenset(outfits[0].item_keys) != frozenset({"e1", "e2", "e3"})


@pytest.mark.parametrize("count", [3, 4])
def test_two_of_each_category_guarantees_minimum_outfits(count):
    pool = [*POOL, CandidateItem("essential", 5, "shoes", "로퍼", "black", ["classic"], None)]

    assert (
        len(compose_basic_outfits(pool, is_outer_required=False, taken=set(), count=count)) == count
    )


# ---------- 가능한 조합 수 ----------

FEW = (
    CandidateItem("essential", 1, "top", "니트", "gray", ["casual"], "medium"),
    CandidateItem("essential", 2, "bottom", "울 슬랙스", "gray", ["classic"], "thick"),
    CandidateItem("essential", 3, "shoes", "첼시부츠", "black", ["minimal"], None),
    CandidateItem("essential", 4, "shoes", "앵클부츠", "black", ["casual"], None),
)
FEW_COMBOS = (["e1", "e2", "e3"], ["e1", "e2", "e4"])


def test_count_possible_combos():
    assert count_possible_combos(POOL, is_outer_required=True) == 4
    assert count_possible_combos(POOL, is_outer_required=False) == 8
    assert count_possible_combos(CANDIDATES, is_outer_required=True) == 32
    assert count_possible_combos(FEW[:2], is_outer_required=False) == 0


async def test_target_is_capped_by_possible_combos():
    llm = fake_llm(generation(("preferred", FEW_COMBOS[0]), ("exploratory", FEW_COMBOS[1])))

    result = await run(llm, candidates=FEW, is_outer_required=False)

    assert len(result.outfits) == 2
    assert result.rounds == 1
    assert result.shortfall_retries == 0
    assert "코디 세트 2벌을 만든다" in prompt_data(llm, 0)


async def test_retry_stops_when_every_combo_is_used():
    llm = fake_llm(generation(("preferred", FEW_COMBOS[0]), ("exploratory", FEW_COMBOS[1])))
    calls: list = []

    result = await run(
        llm,
        candidates=FEW,
        is_outer_required=False,
        review=reviewer("e1"),
        fallback=recording_fallback(calls),
    )

    assert llm.call_structured.await_count == 1
    assert result.reviewer_retries == 0
    assert calls == [[1, 2]]


async def test_no_generation_without_required_category():
    llm = fake_llm()

    result = await run(llm, candidates=FEW[:2], is_outer_required=False)

    assert result.outfits == []
    assert llm.call_structured.await_count == 0


async def test_malformed_drafts_do_not_use_up_possible_combos():
    def reject_malformed(drafts, kept_outfits):
        return [
            OutfitValidation(d.outfit_seq, passed=True)
            if list(d.item_keys) in FEW_COMBOS
            else OutfitValidation(d.outfit_seq, passed=False, reasons=("구성 오류",))
            for d in drafts
        ]

    llm = fake_llm(
        generation(("preferred", ["e1", "e2"]), ("exploratory", ["e1", "e2", "e3", "e4"])),
        generation(("preferred", FEW_COMBOS[0]), ("exploratory", FEW_COMBOS[1])),
    )

    result = await run(llm, candidates=FEW, is_outer_required=False, hard_rule=reject_malformed)

    assert [list(o.item_keys) for o in result.outfits] == list(FEW_COMBOS)
    assert result.rounds == 2
    assert result.fallback_count == 0
