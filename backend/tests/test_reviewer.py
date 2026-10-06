import json
from unittest.mock import AsyncMock, MagicMock

import pytest
from anthropic.types import Message

from app.core.config import Settings, get_settings
from app.services.llm import LLMCallConfig, LLMClient, LLMSchemaError, LLMTimeoutError
from app.services.outfit_validation import OutfitValidation
from app.services.prompt.outfit_review import (
    OutfitReviewOutput,
    ReviewTarget,
    assemble_outfit_review_prompt,
)
from app.services.reviewer import map_review_output, review_outfits
from tests.test_outfit_review_prompt import make_input

TARGETS = (ReviewTarget(1, ["e13"]), ReviewTarget(3, ["e19"]))


def output(*reviews: tuple[int, str, bool]) -> OutfitReviewOutput:
    return OutfitReviewOutput.model_validate(
        {"reviews": [{"outfit_seq": s, "reason": r, "pass": p} for s, r, p in reviews]},
        extra="forbid",
    )


def mock_llm(result=None, side_effect=None) -> MagicMock:
    llm = MagicMock(spec=LLMClient)
    llm.call_structured = AsyncMock(return_value=result, side_effect=side_effect)
    return llm


# ---------- 매핑 ----------


def test_partial_failure_is_mapped_per_outfit():
    results = map_review_output(
        TARGETS,
        output((1, "격식 자리에 맞는다.", True), (3, "운동복을 슬랙스로 바꾼다.", False)),
    )

    assert results == [
        OutfitValidation(1, passed=True),
        OutfitValidation(3, passed=False, reasons=("운동복을 슬랙스로 바꾼다.",)),
    ]


def test_results_are_sorted_by_outfit_seq():
    results = map_review_output(TARGETS, output((3, "적합하다.", True), (1, "적합하다.", True)))

    assert [r.outfit_seq for r in results] == [1, 3]


def test_failure_reason_is_stripped():
    results = map_review_output(
        TARGETS, output((1, "  구두로 바꾼다. \n", False), (3, "적합하다.", True))
    )

    assert results[0].reasons == ("구두로 바꾼다.",)


@pytest.mark.parametrize(
    "reviews",
    [
        [(1, "적합하다.", True)],
        [(1, "적합하다.", True), (3, "적합하다.", True), (2, "적합하다.", True)],
        [(1, "적합하다.", True), (2, "적합하다.", True)],
        [(1, "적합하다.", True), (3, "적합하다.", True), (3, "적합하다.", False)],
        [],
    ],
    ids=["missing", "extra", "wrong", "duplicated", "empty"],
)
def test_outfit_seq_mismatch_raises_schema_error(reviews):
    with pytest.raises(LLMSchemaError):
        map_review_output(TARGETS, output(*reviews))


@pytest.mark.parametrize("reason", ["", "  \n"])
def test_failure_without_reason_raises_schema_error(reason):
    with pytest.raises(LLMSchemaError):
        map_review_output(TARGETS, output((1, reason, False), (3, "적합하다.", True)))


def test_pass_without_reason_is_allowed():
    results = map_review_output(TARGETS, output((1, "", True), (3, "적합하다.", True)))

    assert all(r.passed for r in results)


# ---------- 호출 ----------


async def test_empty_outfits_do_not_call_llm():
    llm = mock_llm()

    assert await review_outfits(llm, make_input(outfits=())) == []
    llm.call_structured.assert_not_awaited()


async def test_call_config_and_prompt_are_passed():
    data = make_input()
    llm = mock_llm(output((1, "운동복을 슬랙스로 바꾼다.", False), (2, "적합하다.", True)))

    results = await review_outfits(llm, data)

    prompt = assemble_outfit_review_prompt(data)
    kwargs = llm.call_structured.await_args.kwargs
    config: LLMCallConfig = llm.call_structured.await_args.args[0]
    assert config.call_name == "outfit_review"
    assert config.prompt_version == "outfit_review/v1.0"
    assert config.temperature == 0.0
    assert config.model == get_settings().LLM_REVIEWER_MODEL
    assert kwargs["system"] == prompt.system
    assert kwargs["messages"] == [{"role": "user", "content": prompt.user}]
    assert kwargs["output_model"] is OutfitReviewOutput
    assert [r.passed for r in results] == [False, True]


async def test_llm_error_is_propagated():
    llm = mock_llm(side_effect=LLMTimeoutError("timed out"))

    with pytest.raises(LLMTimeoutError):
        await review_outfits(llm, make_input())


async def test_request_through_real_client_sends_temperature_and_parses_pass_alias():
    body = {
        "reviews": [
            {"outfit_seq": 2, "reason": "적합하다.", "pass": True},
            {"outfit_seq": 1, "reason": "운동복을 슬랙스로 바꾼다.", "pass": False},
        ]
    }
    message = Message.model_validate(
        {
            "id": "msg_test",
            "type": "message",
            "role": "assistant",
            "model": "claude-haiku-4-5",
            "content": [{"type": "text", "text": json.dumps(body, ensure_ascii=False)}],
            "stop_reason": "end_turn",
            "stop_sequence": None,
            "usage": {"input_tokens": 11, "output_tokens": 7},
        }
    )
    message._request_id = "req_test"
    sdk = MagicMock()
    sdk.messages.create = AsyncMock(return_value=message)
    llm = LLMClient(sdk, Settings(_env_file=None))

    results = await review_outfits(llm, make_input())

    kwargs = sdk.messages.create.await_args.kwargs
    assert kwargs["model"] == get_settings().LLM_REVIEWER_MODEL
    assert kwargs["extra_body"] == {"temperature": 0.0}
    schema = kwargs["output_config"]["format"]["schema"]
    assert list(schema["$defs"]["OutfitReview"]["properties"]) == ["outfit_seq", "reason", "pass"]
    assert results == [
        OutfitValidation(1, passed=False, reasons=("운동복을 슬랙스로 바꾼다.",)),
        OutfitValidation(2, passed=True),
    ]
