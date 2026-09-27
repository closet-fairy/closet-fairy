"""LLM 래퍼 단위 테스트. SDK는 모킹하고 실제 API는 부르지 않는다."""

from __future__ import annotations

import json
import logging
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import anthropic
import httpx2
import pytest
from anthropic.types import Message
from pydantic import BaseModel

from app.core.config import Settings
from app.core.logging import Event, JsonFormatter
from app.llm import (
    LLMCallConfig,
    LLMClient,
    LLMOutputTruncatedError,
    LLMRequestError,
    LLMSchemaError,
    LLMTimeoutError,
)

SYSTEM_PROMPT = "SECRET-SYSTEM-PROMPT-본문"
USER_PROMPT = "SECRET-USER-PROMPT-본문"
ANSWER_TEXT = "SECRET-ANSWER-본문"

_REQUEST = httpx2.Request("POST", "https://api.anthropic.com/v1/messages")


class Answer(BaseModel):
    answer: str
    confidence: float


def _message(text: str, stop_reason: str = "end_turn") -> Message:
    message = Message.model_validate(
        {
            "id": "msg_test",
            "type": "message",
            "role": "assistant",
            "model": "claude-sonnet-5",
            "content": [{"type": "text", "text": text}],
            "stop_reason": stop_reason,
            "stop_sequence": None,
            "usage": {"input_tokens": 11, "output_tokens": 7},
        }
    )
    message._request_id = "req_test"
    return message


def _ok_message() -> Message:
    return _message(json.dumps({"answer": ANSWER_TEXT, "confidence": 0.9}))


def _status_error(cls: type[anthropic.APIStatusError], status: int, **headers: str):
    response = httpx2.Response(status, request=_REQUEST, headers=headers)
    return cls(f"status {status}", response=response, body=None)


def _make(side_effect: Any) -> tuple[LLMClient, AsyncMock]:
    create = AsyncMock(side_effect=side_effect)
    sdk = MagicMock()
    sdk.messages.create = create
    settings = Settings(_env_file=None)

    async def no_sleep(_: float) -> None:
        return None

    return LLMClient(sdk, settings, sleep=no_sleep), create


async def _call(llm: LLMClient, config: LLMCallConfig | None = None) -> Answer:
    return await llm.call_structured(
        config or LLMCallConfig(call_name="test_call", prompt_version="test/v1"),
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": USER_PROMPT}],
        output_model=Answer,
    )


def _llm_records(caplog: pytest.LogCaptureFixture) -> list[logging.LogRecord]:
    return [r for r in caplog.records if getattr(r, "event", None) == Event.LLM_CALL]


async def test_timeout_three_times_raises_timeout_error(caplog):
    llm, create = _make([anthropic.APITimeoutError(request=_REQUEST)] * 3)

    with caplog.at_level(logging.INFO), pytest.raises(LLMTimeoutError) as exc:
        await _call(llm)

    assert create.await_count == 3
    assert exc.value.attempts == 3
    assert isinstance(exc.value.__cause__, anthropic.APITimeoutError)
    (record,) = _llm_records(caplog)
    assert record.attempts == 3
    assert record.outcome == "LLMTimeoutError"


async def test_rate_limit_once_then_success(caplog):
    llm, create = _make([_status_error(anthropic.RateLimitError, 429), _ok_message()])

    with caplog.at_level(logging.INFO):
        result = await _call(llm)

    assert result == Answer(answer=ANSWER_TEXT, confidence=0.9)
    assert create.await_count == 2
    (record,) = _llm_records(caplog)
    assert record.attempts == 2
    assert record.outcome == "success"


async def test_bad_request_is_not_retried():
    llm, create = _make([_status_error(anthropic.BadRequestError, 400)])

    with pytest.raises(LLMRequestError):
        await _call(llm)

    assert create.await_count == 1


async def test_sdk_client_error_is_wrapped(caplog):
    # 인증 수단이 없으면 SDK는 요청 전에 TypeError를 낸다
    llm, create = _make([TypeError("Could not resolve authentication method")])

    with caplog.at_level(logging.INFO), pytest.raises(LLMRequestError) as exc:
        await _call(llm)

    assert isinstance(exc.value.__cause__, TypeError)
    assert create.await_count == 1
    (record,) = _llm_records(caplog)
    assert record.outcome == "LLMRequestError"


@pytest.mark.parametrize(
    "payload",
    [
        {"answer": "a", "confidence": 0.5, "extra": "x"},  # 스키마에 없는 필드
        {"answer": "a", "confidence": "high"},  # 타입 불일치
    ],
)
async def test_schema_mismatch_raises_schema_error_without_retry(payload):
    raw = json.dumps(payload)
    llm, create = _make([_message(raw)])

    with pytest.raises(LLMSchemaError) as exc:
        await _call(llm)

    assert type(exc.value) is LLMSchemaError
    assert exc.value.raw_output == raw
    assert raw not in str(exc.value)
    assert create.await_count == 1


async def test_max_tokens_stop_reason_raises_truncated_error():
    llm, _ = _make([_message('{"answer": "cut', stop_reason="max_tokens")])

    with pytest.raises(LLMOutputTruncatedError) as exc:
        await _call(llm)

    assert exc.value.raw_output == '{"answer": "cut'


async def test_temperature_none_is_omitted_from_request():
    llm, create = _make([_ok_message()])

    await _call(llm)

    kwargs = create.await_args.kwargs
    assert "temperature" not in kwargs
    assert "temperature" not in (kwargs.get("extra_body") or {})


async def test_temperature_value_is_sent_via_extra_body():
    llm, create = _make([_ok_message()])

    await _call(llm, LLMCallConfig(call_name="t", prompt_version="t/v1", temperature=0.3))

    assert create.await_args.kwargs["extra_body"] == {"temperature": 0.3}


async def test_request_uses_structured_output_and_config_values():
    llm, create = _make([_ok_message()])

    await _call(llm, LLMCallConfig(call_name="t", prompt_version="t/v1", timeout_s=12))

    kwargs = create.await_args.kwargs
    assert kwargs["model"] == Settings(_env_file=None).LLM_DEFAULT_MODEL
    assert kwargs["max_tokens"] == 4096
    assert kwargs["timeout"] == 12
    fmt = kwargs["output_config"]["format"]
    assert fmt["type"] == "json_schema"
    assert set(fmt["schema"]["properties"]) == {"answer", "confidence"}


async def test_model_override_by_call_name():
    llm, create = _make([_ok_message()])
    llm._settings = Settings(_env_file=None, LLM_MODEL_OVERRIDES={"image_tagging": "m-x"})

    await _call(llm, LLMCallConfig(call_name="image_tagging", prompt_version="t/v1"))

    assert create.await_args.kwargs["model"] == "m-x"


async def test_log_record_excludes_prompt_and_response_bodies(caplog):
    llm, _ = _make([_ok_message()])

    with caplog.at_level(logging.INFO):
        await _call(llm)

    (record,) = _llm_records(caplog)
    line = JsonFormatter().format(record)
    for secret in (SYSTEM_PROMPT, USER_PROMPT, ANSWER_TEXT):
        assert secret not in line
    payload = json.loads(line)
    assert payload["call_name"] == "test_call"
    assert payload["prompt_version"] == "test/v1"
    assert payload["input_tokens"] == 11
    assert payload["output_tokens"] == 7
    assert payload["llm_request_id"] == "req_test"
    assert isinstance(payload["latency_ms"], float)


async def test_schema_error_log_excludes_raw_output(caplog):
    llm, _ = _make([_message(json.dumps({"answer": ANSWER_TEXT, "confidence": "x"}))])

    with caplog.at_level(logging.INFO), pytest.raises(LLMSchemaError):
        await _call(llm)

    (record,) = _llm_records(caplog)
    assert ANSWER_TEXT not in JsonFormatter().format(record)
    assert record.outcome == "LLMSchemaError"


def test_backoff_uses_retry_after_header_when_short():
    llm, _ = _make([])
    short = _status_error(anthropic.RateLimitError, 429, **{"retry-after": "3"})
    long = _status_error(anthropic.RateLimitError, 429, **{"retry-after": "120"})

    assert llm._retry_delay(1, short) == 3.0
    assert 0.375 <= llm._retry_delay(1, long) <= 0.5
    assert 6.0 <= llm._retry_delay(10, long) <= 8.0
