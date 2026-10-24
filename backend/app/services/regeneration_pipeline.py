"""재추천 파이프라인 (#87, REF-05)."""

import logging
import time
from typing import Any

from app.core.logging import Event
from app.services.llm import LLMClient
from app.services.regeneration_generation import load_regeneration_context, regenerate_outfits
from app.services.regeneration_save import (
    RegenerationDiscardedError,
    mark_regeneration_failed,
    save_regeneration_result,
)

logger = logging.getLogger(__name__)


async def run_regeneration_pipeline(regeneration_request_id: int, llm: LLMClient) -> None:
    started = time.monotonic()
    session_id: int | None = None
    try:
        ctx = await load_regeneration_context(regeneration_request_id)
        session_id = ctx.context.recommendation_session_id
        outcome = await regenerate_outfits(ctx, llm)
        outfits = outcome.generation.outfits
        if not outfits:
            changed = await mark_regeneration_failed(regeneration_request_id)
            fields = _fields(regeneration_request_id, session_id, started)
            if changed is False:
                _log_discarded(fields, "not_processing")
            else:
                logger.warning(
                    "재추천 실패",
                    extra={
                        **fields,
                        "event": Event.REGENERATION_FAILED,
                        "reason": "empty",
                        "status_recorded": changed is True,
                    },
                )
            return
        deck_seq = await save_regeneration_result(
            regeneration_request_id,
            session_id,
            ctx.context.member_id,
            outfits,
            outcome.supplement,
        )
    except RegenerationDiscardedError as e:
        _log_discarded(_fields(regeneration_request_id, session_id, started), e.reason)
        return
    except Exception as e:
        changed = await mark_regeneration_failed(regeneration_request_id)
        fields = _fields(regeneration_request_id, session_id, started)
        # 정리로 요청이 지워졌거나(취소 시 대상 코디와 함께) 시간 초과로 failed된 경우라
        # 그때 난 예외는 버림으로 본다
        if changed is False:
            _log_discarded(fields, "not_processing", error_type=type(e).__name__)
        else:
            logger.exception(
                "재추천 실패",
                extra={
                    **fields,
                    "event": Event.REGENERATION_FAILED,
                    "reason": "error",
                    "error_type": type(e).__name__,
                    "status_recorded": changed is True,
                },
            )
        return

    generation = outcome.generation
    logger.info(
        "재추천 저장",
        extra={
            **_fields(regeneration_request_id, session_id, started),
            "event": Event.REGENERATION_COMPLETED,
            "target_scope_cd": ctx.request.target_scope_cd,
            "deck_seq": deck_seq,
            "outfit_count": len(outfits),
            "outfit_seqs": [o.outfit_seq for o in outfits],
            "rounds": generation.rounds,
            "hard_rule_retries": generation.hard_rule_retries,
            "reviewer_retries": generation.reviewer_retries,
            "shortfall_retries": generation.shortfall_retries,
        },
    )


def _fields(regeneration_request_id: int, session_id: int | None, started: float) -> dict[str, Any]:
    return {
        "recommendation_session_id": session_id,
        "regeneration_request_id": regeneration_request_id,
        "elapsed_ms": round((time.monotonic() - started) * 1000),
    }


def _log_discarded(fields: dict[str, Any], reason: str, **extra: str) -> None:
    logger.warning(
        "재추천 결과 버림",
        extra={**fields, "event": Event.REGENERATION_DISCARDED, "reason": reason, **extra},
    )
