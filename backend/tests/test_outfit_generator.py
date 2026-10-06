"""REC-15 생성·부분 재생성 루프 테스트. LLM·검증 함수는 모두 가짜로 바꿔 끼운다."""

from collections.abc import Sequence
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.services.llm import LLMClient, LLMTimeoutError
from app.services.outfit_generator import (
    FALLBACK_REASON,
    DraftOutfit,
    compose_basic_outfits,
    generate_outfits,
    make_basic_outfit_fallback,
)
from app.services.outfit_validation import OutfitValidation
from app.services.prompt.outfit_generation import (
    CandidateItem,
    KeptOutfit,
    OutfitGenerationOutput,
)
from tests.test_outfit_generation_prompt import make_input

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
    def check(drafts: Sequence[DraftOutfit]) -> list[OutfitValidation]:
        return [
            OutfitValidation(d.outfit_seq, passed=False, reasons=("없는 옷",))
            if bad_key in d.item_keys
            else OutfitValidation(d.outfit_seq, passed=True)
            for d in drafts
        ]

    return check


def all_pass_rule(drafts: Sequence[DraftOutfit]) -> list[OutfitValidation]:
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


def no_fallback(seqs, accepted) -> list[DraftOutfit]:
    return []


def recording_fallback(calls: list):
    def build(seqs, accepted) -> list[DraftOutfit]:
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


def test_compose_returns_empty_without_required_category():
    no_shoes = [c for c in POOL if c.category_cd != "shoes"]

    assert compose_basic_outfits(no_shoes, is_outer_required=False, taken=set(), count=3) == []


def test_fallback_builder_marks_outfits_as_fallback():
    build = make_basic_outfit_fallback(POOL, is_outer_required=False)
    accepted = [DraftOutfit(1, "preferred", ("e1", "e2", "e3"), "통과")]

    outfits = build([2, 3], accepted)

    assert [o.outfit_seq for o in outfits] == [2, 3]
    assert all(o.is_fallback and o.reason == FALLBACK_REASON for o in outfits)
    assert frozenset(outfits[0].item_keys) != frozenset({"e1", "e2", "e3"})


@pytest.mark.parametrize("count", [3, 4])
def test_two_of_each_category_guarantees_minimum_outfits(count):
    pool = [*POOL, CandidateItem("essential", 5, "shoes", "로퍼", "black", ["classic"], None)]

    assert (
        len(compose_basic_outfits(pool, is_outer_required=False, taken=set(), count=count)) == count
    )
