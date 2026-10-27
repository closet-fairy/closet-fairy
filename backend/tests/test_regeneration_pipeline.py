"""재추천 파이프라인 테스트. 생성·저장은 가짜로 바꿔 끼운다."""

from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

from app.services import regeneration_pipeline as pipeline
from app.services.essential_supplement import SupplementResult
from app.services.llm import LLMClient
from app.services.outfit_generator import DraftOutfit, GenerationResult
from app.services.regeneration_generation import RegenerationOutcome
from app.services.regeneration_save import RegenerationDiscardedError

CTX = SimpleNamespace(
    context=SimpleNamespace(recommendation_session_id=7, member_id=1),
    request=SimpleNamespace(target_scope_cd="single"),
)
SUPPLEMENT = SupplementResult(
    candidates=[], is_clothing_shortage=False, outer_requirement="optional"
)
OUTFITS = [DraftOutfit(2, "preferred", ("o11", "o12"), "사유")]


def _outcome(outfits) -> RegenerationOutcome:
    generation = GenerationResult(
        outfits=list(outfits),
        rounds=2,
        hard_rule_retries=1,
        reviewer_retries=0,
        shortfall_retries=0,
        fallback_count=0,
    )
    return RegenerationOutcome(generation, SUPPLEMENT, prompt_input=None)


def _patch(
    monkeypatch,
    *,
    outfits=OUTFITS,
    load_error=None,
    generate_error=None,
    save_error=None,
    mark_result=True,
):
    calls = []

    async def load_regeneration_context(request_id):
        calls.append(("load", request_id))
        if load_error is not None:
            raise load_error
        return CTX

    async def regenerate_outfits(ctx, llm):
        calls.append(("generate",))
        if generate_error is not None:
            raise generate_error
        return _outcome(outfits)

    async def save_regeneration_result(request_id, session_id, member_id, outfits, supplement):
        calls.append(("save", request_id, session_id, member_id, list(outfits), supplement))
        if save_error is not None:
            raise save_error
        return 3

    async def mark_regeneration_failed(request_id):
        calls.append(("mark_failed", request_id))
        return mark_result

    monkeypatch.setattr(pipeline, "load_regeneration_context", load_regeneration_context)
    monkeypatch.setattr(pipeline, "regenerate_outfits", regenerate_outfits)
    monkeypatch.setattr(pipeline, "save_regeneration_result", save_regeneration_result)
    monkeypatch.setattr(pipeline, "mark_regeneration_failed", mark_regeneration_failed)
    return calls


async def _run():
    await pipeline.run_regeneration_pipeline(9, MagicMock(spec=LLMClient))


def _event(caplog, name):
    return next(r for r in caplog.records if getattr(r, "event", None) == name)


async def test_saves_result_and_logs_completed(monkeypatch, caplog):
    calls = _patch(monkeypatch)
    caplog.set_level("INFO")

    await _run()

    assert calls[-1] == ("save", 9, 7, 1, OUTFITS, SUPPLEMENT)
    assert "mark_failed" not in [c[0] for c in calls]
    record = _event(caplog, "regeneration.completed")
    assert record.recommendation_session_id == 7
    assert record.regeneration_request_id == 9
    assert record.target_scope_cd == "single"
    assert record.deck_seq == 3
    assert record.outfit_count == 1
    assert record.outfit_seqs == [2]
    assert record.rounds == 2
    assert record.hard_rule_retries == 1
    assert isinstance(record.elapsed_ms, int)


@pytest.mark.parametrize(("mark_result", "recorded"), [(True, True), (None, False)])
async def test_empty_generation_marks_failed_without_saving(
    monkeypatch, caplog, mark_result, recorded
):
    calls = _patch(monkeypatch, outfits=[], mark_result=mark_result)

    await _run()

    assert "save" not in [c[0] for c in calls]
    assert calls[-1] == ("mark_failed", 9)
    record = _event(caplog, "regeneration.failed")
    assert record.levelname == "WARNING"
    assert record.reason == "empty"
    assert record.status_recorded is recorded
    assert not hasattr(record, "error_type")
    assert not record.exc_info


async def test_empty_generation_for_request_no_longer_processing_is_discarded(monkeypatch, caplog):
    _patch(monkeypatch, outfits=[], mark_result=False)

    await _run()

    record = _event(caplog, "regeneration.discarded")
    assert record.reason == "not_processing"
    assert not hasattr(record, "error_type")
    assert not [r for r in caplog.records if getattr(r, "event", None) == "regeneration.failed"]


@pytest.mark.parametrize(("mark_result", "recorded"), [(True, True), (None, False)])
async def test_error_marks_failed_and_logs_exception(monkeypatch, caplog, mark_result, recorded):
    calls = _patch(monkeypatch, generate_error=RuntimeError("boom"), mark_result=mark_result)

    await _run()

    assert calls[-1] == ("mark_failed", 9)
    record = _event(caplog, "regeneration.failed")
    assert record.levelname == "ERROR"
    assert record.reason == "error"
    assert record.error_type == "RuntimeError"
    assert record.status_recorded is recorded
    assert record.exc_info[0] is RuntimeError


async def test_error_after_request_was_deleted_is_discarded_not_failed(monkeypatch, caplog):
    _patch(monkeypatch, load_error=ValueError("regeneration_request not found"), mark_result=False)

    await _run()

    record = _event(caplog, "regeneration.discarded")
    assert record.reason == "not_processing"
    assert record.error_type == "ValueError"
    assert record.recommendation_session_id is None
    assert not [r for r in caplog.records if r.levelname == "ERROR"]


async def test_discarded_save_is_logged_without_marking_failed(monkeypatch, caplog):
    calls = _patch(monkeypatch, save_error=RegenerationDiscardedError("session_ended"))

    await _run()

    assert "mark_failed" not in [c[0] for c in calls]
    record = _event(caplog, "regeneration.discarded")
    assert record.reason == "session_ended"
    assert record.recommendation_session_id == 7
