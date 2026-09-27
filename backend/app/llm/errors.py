"""LLM 래퍼 예외 계층.

SDK 예외는 래퍼 밖으로 내보내지 않고 여기 정의된 예외로 바꿔 던진다.
원인 예외는 `raise ... from e`로 연결되어 있으니 디버깅은 __cause__로 한다.
"""

from __future__ import annotations


class LLMError(Exception):
    """LLM 호출 실패의 공통 부모."""

    # 래퍼가 채운다. 시도 횟수, SDK가 준 request-id
    attempts: int = 0
    llm_request_id: str | None = None


class LLMTimeoutError(LLMError):
    """재시도를 모두 쓰고도 타임아웃(요청 타임아웃, 408)."""


class LLMRateLimitError(LLMError):
    """재시도를 모두 쓰고도 429."""


class LLMUnavailableError(LLMError):
    """재시도를 모두 쓰고도 5xx·529·409·연결 오류."""


class LLMRequestError(LLMError):
    """재시도하지 않는 4xx (잘못된 요청, 인증 실패, 모델 없음 등)."""


class LLMSchemaError(LLMError):
    """응답이 출력 스키마와 맞지 않음. 재시도하지 않고 재생성 여부는 호출자가 정한다.

    원문 응답은 raw_output 속성에만 보관한다. 메시지·로그에는 넣지 않는다.
    """

    def __init__(self, message: str, raw_output: str | None = None) -> None:
        super().__init__(message)
        self.raw_output = raw_output


class LLMOutputTruncatedError(LLMSchemaError):
    """stop_reason == "max_tokens"로 출력이 잘림."""
