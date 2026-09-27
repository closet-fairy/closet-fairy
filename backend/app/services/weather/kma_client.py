"""기상청 단기예보 API 클라이언트 (초단기실황 + 단기예보)."""
from datetime import datetime

import httpx

from app.services.weather.base_time import ultra_srt_ncst_base, vilage_fcst_base
from app.services.weather.kma_http import request_items

BASE_URL = "https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0"


class KmaClient:
    def __init__(
        self,
        service_key: str,
        timeout: float = 5.0,
        transport: httpx.AsyncBaseTransport | None = None,  # 테스트에서 가짜 응답을 끼울 때만 사용
    ) -> None:
        self._service_key = service_key
        self._timeout = timeout
        self._transport = transport

    async def _call(self, operation: str, params: dict) -> list[dict]:
        items, _ = await request_items(
            f"{BASE_URL}/{operation}", params, self._service_key, self._timeout, self._transport
        )
        return items

    async def get_ultra_srt_ncst(self, nx: int, ny: int, now: datetime) -> list[dict]:
        """초단기실황 = 지금 관측값. category: T1H 기온, RN1 강수, WSD 풍속, PTY 강수형태, REH 습도"""
        base_date, base_time = ultra_srt_ncst_base(now)
        return await self._call(
            "getUltraSrtNcst",
            {"pageNo": 1, "numOfRows": 100, "base_date": base_date, "base_time": base_time, "nx": nx, "ny": ny},
        )

    async def get_vilage_fcst(self, nx: int, ny: int, now: datetime) -> list[dict]:
        """단기예보 = 시간대별 예보. category: TMP 기온, PCP 강수, WSD 풍속, SKY 하늘, PTY 강수형태, POP 강수확률
        1000행이면 오늘~내일(약 80시간) 분량이 충분히 들어온다."""
        base_date, base_time = vilage_fcst_base(now)
        return await self._call(
            "getVilageFcst",
            {"pageNo": 1, "numOfRows": 1000, "base_date": base_date, "base_time": base_time, "nx": nx, "ny": ny},
        )
