"""LLM 호출 래퍼.

추천·재추천·2차 검증·이미지 태깅이 공통으로 쓴다.

- 재시도는 여기 한 곳에서만 한다 (SDK 재시도는 max_retries=0으로 끔).
- 구조화 출력은 API의 output_config.format(json_schema)을 쓴다. SDK의 messages.parse()는
  응답을 받자마자 검증해서 stop_reason 확인 전에 예외가 나고 원문도 잃기 때문에,
  같은 요청을 messages.create()로 보내고 검증은 여기서 직접 한다.
- 호출 1건당 로그 1줄. 프롬프트·응답 본문, member_id, 이미지 URL, API 키는 남기지 않는다.
"""

from __future__ import annotations

import asyncio
import json
import logging
import random
import time
from collections.abc import Awaitable, Callable, Iterable
from dataclasses import dataclass
from typing import Any, TypeVar

import anthropic
import pydantic
from anthropic import AsyncAnthropic
from anthropic.types import Message, MessageParam

from app.core.config import Settings
from app.core.logging import Event
from app.llm.errors import (
    LLMError,
    LLMOutputTruncatedError,
    LLMRateLimitError,
    LLMRequestError,
    LLMSchemaError,
    LLMTimeoutError,
    LLMUnavailableError,
)

logger = logging.getLogger("app.llm")

T = TypeVar("T", bound=pydantic.BaseModel)

# retry-after 헤더가 이보다 길면 무시하고 지수 백오프를 쓴다 (SDK와 같은 기준)
_RETRY_AFTER_MAX_S = 60.0
_RETRYABLE_STATUS = frozenset({408, 409, 429})


@dataclass(frozen=True)
class LLMCallConfig:
    """호출 1건의 설정. 모델명은 코드에 쓰지 않고 설정(.env)에서 고른다."""

    call_name: str
    prompt_version: str
    # None이면 LLM_MODEL_OVERRIDES[call_name] → LLM_DEFAULT_MODEL 순으로 정한다
    model: str | None = None
    max_tokens: int = 4096
    # None이면 요청에서 생략한다. claude-sonnet-5 등 최신 모델은 기본값이 아닌
    # temperature를 400으로 거절하므로, 받는 모델을 쓰는 호출에서만 값을 넣는다.
    temperature: float | None = None
    timeout_s: float = 60.0


class LLMClient:
    """앱 수명 동안 하나만 만들어 재사용한다 (app.llm.deps 참고)."""

    def __init__(
        self,
        client: AsyncAnthropic,
        settings: Settings,
        *,
        sleep: Callable[[float], Awaitable[None]] = asyncio.sleep,
    ) -> None:
        self._client = client
        self._settings = settings
        self._sleep = sleep  # 테스트에서 백오프 대기를 0으로 바꾸기 위한 주입점

    async def aclose(self) -> None:
        await self._client.close()

    def resolve_model(self, config: LLMCallConfig) -> str:
        if config.model:
            return config.model
        return self._settings.LLM_MODEL_OVERRIDES.get(
            config.call_name, self._settings.LLM_DEFAULT_MODEL
        )

    async def call_structured(
        self,
        config: LLMCallConfig,
        system: str,
        messages: Iterable[MessageParam],
        output_model: type[T],
    ) -> T:
        model = self.resolve_model(config)
        request: dict[str, Any] = {
            "model": model,
            "max_tokens": config.max_tokens,
            "system": system,
            "messages": list(messages),
            "output_config": {
                "format": {
                    "type": "json_schema",
                    "schema": anthropic.transform_schema(output_model),
                }
            },
            "timeout": config.timeout_s,
        }
        if config.temperature is not None:
            # SDK 1.x는 temperature 인자를 없앴다. API로는 extra_body로만 보낼 수 있다.
            request["extra_body"] = {"temperature": config.temperature}

        start = time.perf_counter()
        attempts = 0
        response: Message | None = None
        request_id: str | None = None
        outcome = "success"
        try:
            response, attempts = await self._create_with_retry(request)
            request_id = response._request_id
            return _parse_output(response, output_model)
        except LLMError as e:
            outcome = type(e).__name__
            request_id = request_id or e.llm_request_id
            attempts = attempts or e.attempts
            e.attempts, e.llm_request_id = attempts, request_id
            raise
        except BaseException as e:  # 예상 못한 예외(취소 포함)도 로그 outcome은 정확히 남긴다
            outcome = type(e).__name__
            raise
        finally:
            usage = response.usage if response is not None else None
            logger.info(
                "llm call %s -> %s",
                config.call_name,
                outcome,
                extra={
                    "event": Event.LLM_CALL,
                    "call_name": config.call_name,
                    "model": model,
                    "prompt_version": config.prompt_version,
                    "latency_ms": round((time.perf_counter() - start) * 1000, 1),
                    "input_tokens": usage.input_tokens if usage else None,
                    "output_tokens": usage.output_tokens if usage else None,
                    "attempts": attempts,
                    "outcome": outcome,
                    # request_id 키는 HTTP 요청 ID가 쓰고 있어서 이름을 구분한다
                    "llm_request_id": request_id,
                },
            )

    async def _create_with_retry(self, request: dict[str, Any]) -> tuple[Message, int]:
        max_attempts = max(1, self._settings.LLM_MAX_ATTEMPTS)
        attempt = 0
        while True:
            attempt += 1
            try:
                message = await self._client.messages.create(**request)
                return message, attempt
            except anthropic.APIError as e:
                if not _is_retryable(e) or attempt >= max_attempts:
                    err = _to_llm_error(e)
                    err.attempts = attempt
                    err.llm_request_id = getattr(e, "request_id", None)
                    raise err from e
                await self._sleep(self._retry_delay(attempt, e))
            except (anthropic.AnthropicError, TypeError) as e:
                # 요청을 보내기 전에 SDK가 거절한 경우 (인증 수단 없음, 잘못된 인자 등)
                err = LLMRequestError(f"LLM client rejected the request ({type(e).__name__})")
                err.attempts = attempt
                raise err from e

    def _retry_delay(self, retry_number: int, error: anthropic.APIError) -> float:
        retry_after = _retry_after_seconds(error)
        if retry_after is not None and 0 <= retry_after <= _RETRY_AFTER_MAX_S:
            return retry_after
        s = self._settings
        delay = min(s.LLM_BACKOFF_BASE_S * 2 ** (retry_number - 1), s.LLM_BACKOFF_MAX_S)
        return delay * (1 - 0.25 * random.random())


def _is_retryable(e: anthropic.APIError) -> bool:
    if isinstance(e, anthropic.APIConnectionError):  # APITimeoutError 포함
        return True
    if isinstance(e, anthropic.APIStatusError):
        return e.status_code in _RETRYABLE_STATUS or e.status_code >= 500
    return False


def _to_llm_error(e: anthropic.APIError) -> LLMError:
    # 메시지에는 상태 코드·오류 종류만 넣는다. 원인은 __cause__로 따라간다.
    if isinstance(e, anthropic.APITimeoutError):
        return LLMTimeoutError("LLM request timed out")
    if isinstance(e, anthropic.APIConnectionError):
        return LLMUnavailableError("LLM connection failed")
    if isinstance(e, anthropic.APIStatusError):
        status = e.status_code
        if status == 408:
            return LLMTimeoutError("LLM request timed out (408)")
        if status == 429:
            return LLMRateLimitError("LLM rate limited (429)")
        if status == 409 or status >= 500:
            return LLMUnavailableError(f"LLM unavailable ({status})")
        return LLMRequestError(f"LLM request rejected ({status} {type(e).__name__})")
    return LLMError(f"LLM call failed ({type(e).__name__})")


def _retry_after_seconds(e: anthropic.APIError) -> float | None:
    response = getattr(e, "response", None)
    if response is None:
        return None
    for header, scale in (("retry-after-ms", 1000.0), ("retry-after", 1.0)):
        value = response.headers.get(header)
        if value is None:
            continue
        try:
            return float(value) / scale
        except ValueError:
            continue
    return None


def _parse_output(response: Message, output_model: type[T]) -> T:
    raw = "".join(block.text for block in response.content if block.type == "text")
    if response.stop_reason == "max_tokens":
        raise LLMOutputTruncatedError("LLM output truncated (max_tokens)", raw_output=raw)
    if response.stop_reason == "refusal":
        raise LLMSchemaError("LLM refused to answer", raw_output=raw)
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        raise LLMSchemaError("LLM output is not valid JSON", raw_output=raw) from e
    try:
        # 스키마에 없는 필드도 실패로 본다
        return output_model.model_validate(data, extra="forbid")
    except pydantic.ValidationError as e:
        # ValidationError 문자열에는 입력값이 들어가므로 오류 개수만 남긴다
        raise LLMSchemaError(
            f"LLM output failed schema validation ({e.error_count()} errors)", raw_output=raw
        ) from e
