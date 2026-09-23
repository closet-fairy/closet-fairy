"""JSON 구조 로그 + 요청별 request_id.

이벤트명을 여기 상수로 모아둔다. 나중에 로그를 집계해서
1차/2차 검증 실패율, 재생성 횟수 같은 발표용 지표를 뽑을 때
문자열을 코드 여기저기서 다르게 쓰는 걸 막기 위함이다.
"""
from __future__ import annotations

import json
import logging
import sys
import time
import uuid
from contextvars import ContextVar

from starlette.types import ASGIApp, Receive, Scope, Send

# 요청 하나의 흐름 전체에서 같은 값을 공유하는 컨텍스트 변수
_request_id_ctx: ContextVar[str] = ContextVar("request_id", default="-")

# logging.LogRecord가 기본으로 갖는 속성 이름. 이것만 걸러내면
# extra={...}로 넘긴 값만 정확히 남는다. (LogRecord.__dict__로는
# 클래스 속성이 아니라 인스턴스 속성이라 걸러지지 않는다)
_STANDARD_LOG_RECORD_KEYS = frozenset(logging.LogRecord(
    "", 0, "", 0, "", (), None,
).__dict__.keys()) | {"message", "asctime"}


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "ts": self.formatTime(record, "%Y-%m-%dT%H:%M:%S%z"),
            "level": record.levelname,
            "logger": record.name,
            "request_id": _request_id_ctx.get(),
            "message": record.getMessage(),
        }
        # extra={"event": "...", ...}로 넘긴 값만 골라서 추가한다
        for key, value in record.__dict__.items():
            if key in _STANDARD_LOG_RECORD_KEYS or key in payload:
                continue
            payload[key] = value
        return json.dumps(payload, ensure_ascii=False, default=str)


def setup_logging(level: int = logging.INFO) -> None:
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())
    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(level)


class RequestIdMiddleware:
    """요청마다 request_id를 발급해 로그와 응답 헤더에 심는다.

    BaseHTTPMiddleware는 응답을 별도 태스크에서 처리해 contextvar가
    전파되지 않는 문제가 있어(starlette의 알려진 제약), 순수 ASGI
    미들웨어로 직접 구현한다.
    """

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        headers = dict(scope.get("headers") or [])
        incoming_id = headers.get(b"x-request-id")
        request_id = incoming_id.decode() if incoming_id else str(uuid.uuid4())
        token = _request_id_ctx.set(request_id)

        start = time.perf_counter()
        status_code = 500

        async def send_wrapper(message: dict) -> None:
            nonlocal status_code
            if message["type"] == "http.response.start":
                status_code = message["status"]
                headers_list = list(message.get("headers", []))
                headers_list.append((b"x-request-id", request_id.encode()))
                message = {**message, "headers": headers_list}
            await send(message)

        try:
            await self.app(scope, receive, send_wrapper)
        finally:
            elapsed_ms = round((time.perf_counter() - start) * 1000, 1)
            logging.getLogger("app.request").info(
                "%s %s -> %s", scope["method"], scope["path"], status_code,
                extra={"event": "http.request", "elapsed_ms": elapsed_ms,
                       "status_code": status_code},
            )
            _request_id_ctx.reset(token)


class Event:
    """발표 정량 근거 산출에 쓰는 이벤트명. logger.info(..., extra={"event": Event.X})로 사용."""

    HARD_RULE_FAIL = "validation.hard_rule.fail"
    REVIEWER_FAIL = "validation.reviewer.fail"
    RECOMMEND_REGENERATE = "recommend.regenerate"
    RECOMMEND_FALLBACK = "recommend.fallback"
    PREFERENCE_SETTLED = "preference.settled"
    UCB_EXPLORE_PICK = "ucb.explore_pick"
