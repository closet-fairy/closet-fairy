from __future__ import annotations


class LLMError(Exception):
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
    """재시도하지 않는 요청 오류 (4xx, 그리고 SDK가 요청 전에 거절한 경우)."""


class LLMSchemaError(LLMError):
    """응답이 출력 스키마와 맞지 않음. 재시도하지 않고 재생성 여부는 호출자가 정한다.

    원문 응답은 raw_output 속성에만 보관한다. 메시지·로그에는 넣지 않는다.
    """

    def __init__(self, message: str, raw_output: str | None = None) -> None:
        super().__init__(message)
        self.raw_output = raw_output


class LLMOutputTruncatedError(LLMSchemaError):
    """stop_reason == "max_tokens"로 출력이 잘림."""
