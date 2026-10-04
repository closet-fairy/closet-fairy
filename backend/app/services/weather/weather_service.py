"""추천에 쓸 날씨 한 벌을 만든다: 현재값 + 시간대별 + 외출 시간대 최저 체감온도.

API가 죽어도 추천은 계속돼야 하므로, 어떤 오류든 예외를 밖으로 던지지 않고
대체값(is_fallback=True)을 돌려준다. (지역 이름이 잘못된 경우만 예외)
"""

import asyncio
import logging
import re
from collections import defaultdict
from dataclasses import asdict, dataclass, field
from datetime import datetime, timedelta

from app.core.config import get_settings
from app.services.weather.base_time import KST
from app.services.weather.feels_like import feels_like
from app.services.weather.kma_client import KmaClient
from app.services.weather.regions import find_region

logger = logging.getLogger(__name__)

# 대체값: 월별 평균기온 (서울 평년값 근사, 1월~12월)
MONTHLY_NORMAL_TEMPERATURE = (-2.0, 0.6, 5.8, 12.5, 17.8, 22.2, 24.9, 25.7, 21.2, 14.8, 7.2, 0.4)


@dataclass
class HourlyWeather:
    at: datetime  # KST
    temperature: float
    feels_like_temperature: float
    precipitation: float
    wind_speed: float
    weather_condition_cd: str


@dataclass
class WeatherResult:
    temperature: float
    feels_like_temperature: float
    precipitation: float
    wind_speed: float
    weather_condition_cd: str
    min_feels_like_temperature: float  # 외출 시간대 최저 체감온도 (아우터 판정용)
    is_fallback: bool = False
    is_sky_missing: bool = False  # SKY 예보가 없어 맑음으로 가정함 (미리보기는 하늘상태를 숨길 것)
    hourly: list[HourlyWeather] = field(default_factory=list)

    def hourly_json(self) -> list[dict]:
        """weather_snapshot.hourly_forecast(JSON 컬럼)에 넣을 형태."""
        return [{**asdict(h), "at": h.at.isoformat()} for h in self.hourly]


# ---------- 값 해석 ----------


def parse_precipitation(value: object) -> float:
    """'강수없음' → 0, '1mm 미만' → 0.5, '1.0mm' → 1.0,

    '30.0~50.0mm' → 30.0, '50.0mm 이상' → 50.0
    """
    text = str(value).strip()
    if text in ("", "-", "강수없음"):
        return 0.0
    if "미만" in text:
        return 0.5
    numbers = re.findall(r"\d+(?:\.\d+)?", text)
    return float(numbers[0]) if numbers else 0.0


def condition_cd(pty: int, sky: int | None) -> str:
    """PTY(강수형태)가 있으면 우선, 없으면 SKY(하늘상태)."""
    if pty in (1, 4, 5):
        return "rain"
    if pty in (2, 6):
        return "sleet"
    if pty in (3, 7):
        return "snow"
    return {1: "clear", 3: "cloudy", 4: "overcast"}.get(sky or 1, "clear")


def build_hourly(fcst_items: list[dict]) -> list[HourlyWeather]:
    by_hour: dict[tuple[str, str], dict[str, str]] = defaultdict(dict)
    for item in fcst_items:
        by_hour[(item["fcstDate"], item["fcstTime"])][item["category"]] = item["fcstValue"]

    hourly = []
    for (d, t), v in sorted(by_hour.items()):
        if "TMP" not in v:
            continue
        temp = float(v["TMP"])
        wind = float(v.get("WSD", 0))
        hourly.append(
            HourlyWeather(
                at=datetime.strptime(d + t, "%Y%m%d%H%M").replace(tzinfo=KST),
                temperature=temp,
                feels_like_temperature=feels_like(temp, wind),
                precipitation=parse_precipitation(v.get("PCP", "강수없음")),
                wind_speed=wind,
                weather_condition_cd=condition_cd(int(v.get("PTY", 0)), int(v.get("SKY", 1))),
            )
        )
    return hourly


def nearest_sky(fcst_items: list[dict], now: datetime) -> int | None:
    """현재 시각에 가장 가까운 예보 시각의 SKY(하늘상태). 거리가 같으면 이른 시각을 쓴다."""
    skies = [
        (
            datetime.strptime(i["fcstDate"] + i["fcstTime"], "%Y%m%d%H%M").replace(tzinfo=KST),
            int(i["fcstValue"]),
        )
        for i in fcst_items
        if i["category"] == "SKY"
    ]
    if not skies:
        return None
    now_kst = now.astimezone(KST)
    _, sky = min(skies, key=lambda s: (abs(s[0] - now_kst), s[0]))
    return sky


def combine(
    ncst_items: list[dict],
    fcst_items: list[dict],
    going_out_start: datetime,
    going_out_end: datetime,
    now: datetime,
) -> WeatherResult:
    now_values = {i["category"]: i["obsrValue"] for i in ncst_items}
    temp = float(now_values["T1H"])
    wind = float(now_values.get("WSD", 0))
    current_feels = feels_like(temp, wind)
    hourly = build_hourly(fcst_items)

    # 실황에는 하늘상태(SKY)가 없어, 현재 시각에 가장 가까운 예보 시각의 SKY를 빌려 쓴다
    pty = int(float(now_values.get("PTY", 0)))
    sky = nearest_sky(fcst_items, now)

    # 외출 시간대: 시작 시각이 속한 정시부터 종료 시각까지
    window_start = going_out_start.replace(minute=0, second=0, microsecond=0)
    in_window = [h.feels_like_temperature for h in hourly if window_start <= h.at <= going_out_end]

    # 외출 시작이 지금과 같은 정시일 때만 현재 관측값을 후보에 섞는다.
    # (아니면, 외출과 무관한 지금 기온이 미래 외출의 최저값으로 잘못 반영된다)
    now_hour = now.replace(minute=0, second=0, microsecond=0)
    candidates = in_window + [current_feels] if window_start == now_hour else in_window
    min_feels = min(candidates) if candidates else current_feels

    return WeatherResult(
        temperature=temp,
        feels_like_temperature=current_feels,
        precipitation=parse_precipitation(now_values.get("RN1", 0)),
        wind_speed=wind,
        weather_condition_cd=condition_cd(pty, sky),
        is_sky_missing=sky is None and pty == 0,
        min_feels_like_temperature=min_feels,
        hourly=hourly,
    )


def fallback_weather(now: datetime) -> WeatherResult:
    temp = MONTHLY_NORMAL_TEMPERATURE[now.astimezone(KST).month - 1]
    return WeatherResult(
        temperature=temp,
        feels_like_temperature=temp,
        precipitation=0.0,
        wind_speed=0.0,
        weather_condition_cd="clear",
        min_feels_like_temperature=temp,
        is_fallback=True,
    )


# ---------- 진입점 ----------


async def get_weather(
    sido_nm: str,
    sigungu_nm: str | None,
    going_out_start: datetime | None = None,
    going_out_end: datetime | None = None,
    now: datetime | None = None,
    client: KmaClient | None = None,
) -> WeatherResult:
    region = find_region(sido_nm, sigungu_nm)  # 잘못된 지역은 여기서 404 예외
    now = now or datetime.now(KST)
    going_out_start = going_out_start or now
    going_out_end = going_out_end or now + timedelta(hours=1)
    if client is None:
        settings = get_settings()
        client = KmaClient(settings.KMA_SERVICE_KEY, settings.KMA_TIMEOUT_SECONDS)

    try:
        ncst, fcst = await asyncio.gather(
            client.get_ultra_srt_ncst(region.grid_nx, region.grid_ny, now),
            client.get_vilage_fcst(region.grid_nx, region.grid_ny, now),
        )
        return combine(ncst, fcst, going_out_start, going_out_end, now)
    except Exception:  # noqa: BLE001 - 날씨 장애로 추천이 멈추면 안 된다
        logger.warning("weather.fallback", exc_info=True)
        return fallback_weather(now)
