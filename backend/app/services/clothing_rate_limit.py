"""옷 등록·재시도 요청 빈도 제한 (남용 방지, FR-REG).

회원마다 최근 window_s초 동안의 요청 시각을 기억하고, limit번을 넘으면 거절한다.
서버 메모리에 두므로 서버가 한 대라는 전제다(처리 워커와 같다).
"""

import time
from collections import deque
from collections.abc import Callable
from functools import lru_cache

from app.core.config import get_settings
from app.core.errors import TooManyRequestsError

WINDOW_S = 60.0


class TooManyClothingRequestsError(TooManyRequestsError):
    code = "CLOTHING_TOO_MANY_REQUESTS"
    message = "옷 등록 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요."


class RequestRateLimiter:
    def __init__(
        self,
        limit: int,
        window_s: float = WINDOW_S,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self._limit = limit
        self._window_s = window_s
        self._clock = clock
        self._requests: dict[int, deque[float]] = {}
        self._last_sweep = clock()

    def check(self, member_id: int) -> None:
        now = self._clock()
        if now - self._last_sweep >= self._window_s:
            self._sweep(now)
        requests = self._requests.setdefault(member_id, deque())
        while requests and requests[0] <= now - self._window_s:
            requests.popleft()
        if len(requests) >= self._limit:
            raise TooManyClothingRequestsError()
        requests.append(now)

    def _sweep(self, now: float) -> None:
        cutoff = now - self._window_s
        self._requests = {
            member_id: requests
            for member_id, requests in self._requests.items()
            if requests and requests[-1] > cutoff
        }
        self._last_sweep = now


@lru_cache
def get_clothing_rate_limiter() -> RequestRateLimiter:
    return RequestRateLimiter(get_settings().CLOTHING_REQUEST_LIMIT_PER_MINUTE)
