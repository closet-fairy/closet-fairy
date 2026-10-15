"""재추천 요청 접수 (#85, FR-REF-01~03·18, EX-REF-01·02·06·07).

의도 파싱 중에는 DB 잠금을 쥐지 않는다. 그래서 잠그기 전에 한 번 거르고, 잠근 뒤에 세션 상태와
재생성 중 여부, 대상 코디를 다시 확인한다.
"""

import json
import logging
from dataclasses import dataclass
from datetime import datetime, timedelta

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.core.errors import ConflictError, ServiceUnavailableError, ValidationError
from app.core.logging import Event
from app.repositories import recommendation_deck as deck_repo
from app.repositories import recommendation_session as session_repo
from app.repositories import regeneration_request as regeneration_repo
from app.repositories.recommendation_session import SessionStateRow
from app.schemas.regeneration_request import RegenerationCreate
from app.services.input_guard import is_harmful
from app.services.llm import LLMClient, LLMError, LLMRefusalError
from app.services.recommendation_session import to_db_utc
from app.services.regeneration_intent import RegenerationIntent, parse_regeneration_intent
from app.services.session_errors import (
    OutfitNotInSessionError,
    SessionAlreadySettledError,
    SessionEndedError,
    SessionNotFoundError,
    SessionNotReadyError,
)

logger = logging.getLogger(__name__)

MYSQL_DUPLICATE_ENTRY = 1062


class RegenerationRequestTooLongError(ValidationError):
    code = "REGENERATION_REQUEST_TOO_LONG"
    message = "재추천 요청이 너무 깁니다."

    def __init__(self, max_length: int) -> None:
        super().__init__(
            f"요청은 {max_length}자까지 입력할 수 있습니다. 조금 줄여서 다시 입력해 주세요."
        )


class RegenerationRequestHarmfulError(ValidationError):
    code = "REGENERATION_REQUEST_HARMFUL"
    message = "입력할 수 없는 내용이 포함되어 있습니다."


class RegenerationRequestUnclearError(ValidationError):
    code = "REGENERATION_REQUEST_UNCLEAR"
    message = "요청을 이해하지 못했습니다. 다시 말씀해 주세요."


class RegenerationTargetNotLatestError(ValidationError):
    code = "REGENERATION_TARGET_NOT_LATEST"
    message = "지금 보고 있는 코디를 골라 다시 요청해 주세요."


class RegenerationInProgressError(ConflictError):
    code = "REGENERATION_IN_PROGRESS"
    message = "앞서 요청한 코디를 만들고 있습니다. 끝난 뒤에 다시 요청해 주세요."


class RegenerationIntentUnavailableError(ServiceUnavailableError):
    code = "REGENERATION_INTENT_UNAVAILABLE"
    message = "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요."


@dataclass(frozen=True)
class AcceptedRegeneration:
    regeneration_request_id: int
    request_seq: int


async def request_regeneration(
    db: AsyncSession,
    llm: LLMClient,
    recommendation_session_id: int,
    member_id: int,
    req: RegenerationCreate,
    now: datetime,
) -> AcceptedRegeneration:
    settings = get_settings()
    stale_before = to_db_utc(
        now - timedelta(seconds=settings.REGENERATION_PROCESSING_TIMEOUT_SECONDS)
    )
    request_text = req.request_text.strip()

    async with db.begin():
        session = await session_repo.get_session_state(db, recommendation_session_id)
        ensure_regeneratable(session, member_id)
        if await regeneration_repo.has_processing_request(
            db, recommendation_session_id, stale_before
        ):
            _log_rejected(recommendation_session_id, "in_progress", request_text)
            raise RegenerationInProgressError()
        if req.target_outfit_id is not None:
            await _ensure_latest_outfit(db, recommendation_session_id, req.target_outfit_id)

    validate_request_text(recommendation_session_id, request_text, settings)
    intent = await _parse_intent(llm, recommendation_session_id, request_text)

    try:
        async with db.begin():
            session = await session_repo.lock_session(db, recommendation_session_id)
            ensure_regeneratable(session, member_id)
            timed_out_count = await regeneration_repo.fail_stale_processing(
                db, recommendation_session_id, stale_before
            )
            if await regeneration_repo.has_processing_request(
                db, recommendation_session_id, stale_before
            ):
                _log_rejected(recommendation_session_id, "in_progress", request_text)
                raise RegenerationInProgressError()
            if req.target_outfit_id is not None:
                await _ensure_latest_outfit(db, recommendation_session_id, req.target_outfit_id)

            request_seq = await regeneration_repo.next_request_seq(db, recommendation_session_id)
            regeneration_request_id = await regeneration_repo.insert_request(
                db,
                recommendation_session_id=recommendation_session_id,
                request_seq=request_seq,
                target_scope_cd=req.target_scope_cd,
                target_outfit_id=req.target_outfit_id,
                target_slot_cd=req.target_slot_cd,
                request_text=request_text,
                parsed_intent=json.dumps(intent.to_dict(), ensure_ascii=False),
            )
    except IntegrityError as e:
        # 세션 행을 잠그므로 보통은 생기지 않는다. UNIQUE(session, request_seq)가 마지막 안전장치다
        if _is_duplicate_entry(e):
            _log_rejected(recommendation_session_id, "in_progress", request_text)
            raise RegenerationInProgressError() from e
        raise

    if timed_out_count:
        logger.info(
            "시간 초과된 재추천 요청 실패 처리",
            extra={
                "event": Event.REGENERATION_TIMED_OUT,
                "recommendation_session_id": recommendation_session_id,
                "failed_count": timed_out_count,
            },
        )
    logger.info(
        "재추천 요청 접수",
        extra={
            "event": Event.REGENERATION_REQUESTED,
            "recommendation_session_id": recommendation_session_id,
            "regeneration_request_id": regeneration_request_id,
            "request_seq": request_seq,
            "target_scope_cd": req.target_scope_cd,
            "has_target_slot": req.target_slot_cd is not None,
            "request_length": len(request_text),
        },
    )
    return AcceptedRegeneration(regeneration_request_id, request_seq)


def ensure_regeneratable(session: SessionStateRow | None, member_id: int) -> None:
    if session is None or session.member_id != member_id:
        raise SessionNotFoundError()
    if session.settled_at is not None or session.session_status_cd == "completed":
        raise SessionAlreadySettledError()
    if session.session_status_cd != "active":
        raise SessionEndedError()
    if session.generation_status_cd != "completed":
        raise SessionNotReadyError()


def validate_request_text(
    recommendation_session_id: int, request_text: str, settings: Settings
) -> None:
    if not request_text:
        _log_rejected(recommendation_session_id, "empty", request_text)
        raise RegenerationRequestUnclearError()
    max_length = settings.REGENERATION_REQUEST_MAX_LENGTH
    if len(request_text) > max_length:
        _log_rejected(recommendation_session_id, "too_long", request_text)
        raise RegenerationRequestTooLongError(max_length)
    if is_harmful(request_text):
        _log_rejected(recommendation_session_id, "harmful_input", request_text)
        raise RegenerationRequestHarmfulError()


async def _parse_intent(
    llm: LLMClient, recommendation_session_id: int, request_text: str
) -> RegenerationIntent:
    try:
        intent = await parse_regeneration_intent(llm, request_text)
    except LLMRefusalError as e:
        # 거부는 대개 패턴 검사를 빠져나간 유해 입력 때문이라, 같은 문장을 다시 보내도 또 거부된다
        _log_rejected(recommendation_session_id, "intent_refused", request_text)
        raise RegenerationRequestHarmfulError() from e
    except LLMError as e:
        _log_rejected(
            recommendation_session_id, "intent_failed", request_text, error_type=type(e).__name__
        )
        raise RegenerationIntentUnavailableError() from e

    if intent.status == "harmful":
        _log_rejected(recommendation_session_id, "harmful_intent", request_text)
        raise RegenerationRequestHarmfulError()
    if intent.status == "unclear":
        _log_rejected(recommendation_session_id, "unclear", request_text)
        raise RegenerationRequestUnclearError()
    return intent


async def _ensure_latest_outfit(
    db: AsyncSession, recommendation_session_id: int, outfit_id: int
) -> None:
    position = await deck_repo.get_outfit_deck_position(db, recommendation_session_id, outfit_id)
    if position is None:
        raise OutfitNotInSessionError()
    if not position.is_latest:
        raise RegenerationTargetNotLatestError()


def _log_rejected(
    recommendation_session_id: int, reason: str, request_text: str, **fields: str
) -> None:
    logger.info(
        "재추천 요청 거절",
        extra={
            "event": Event.REGENERATION_REJECTED,
            "recommendation_session_id": recommendation_session_id,
            "reason": reason,
            "request_length": len(request_text),
            **fields,
        },
    )


def _is_duplicate_entry(error: IntegrityError) -> bool:
    args = getattr(error.orig, "args", ())
    return bool(args) and args[0] == MYSQL_DUPLICATE_ENTRY
