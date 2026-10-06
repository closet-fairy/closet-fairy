"""2차 검증(리뷰어) 스모크 테스트. 실제 API를 3회 호출한다 (비용 발생).

backend/ 폴더에서 실행한다:
    python scripts/reviewer_smoke.py
.env의 ANTHROPIC_API_KEY가 필요하다. DB 없이 에센셜 시드(003_essential.sql)의 id를 그대로 쓴다.
기대한 판정과 다르면 exit 1로 끝난다.
"""

from __future__ import annotations

import asyncio
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import get_settings  # noqa: E402
from app.core.logging import setup_logging  # noqa: E402
from app.services.llm import create_llm_client  # noqa: E402
from app.services.prompt.outfit_generation import (  # noqa: E402
    CandidateItem,
    HourlyForecast,
    WeatherInput,
)
from app.services.prompt.outfit_review import OutfitReviewInput, ReviewTarget  # noqa: E402
from app.services.reviewer import review_outfits  # noqa: E402
from app.services.weather.base_time import KST  # noqa: E402

CANDIDATES = (
    CandidateItem("essential", 3, "outer", "네이비 블레이저", "navy", ["classic"], "medium"),
    CandidateItem("essential", 6, "outer", "네이비 바람막이", "navy", ["sporty"], "thin"),
    CandidateItem("essential", 8, "top", "화이트 베이직 셔츠", "white", ["formal"], "thin"),
    CandidateItem("essential", 13, "top", "블랙 기능성 티셔츠", "black", ["sporty"], "thin"),
    CandidateItem("essential", 14, "bottom", "블랙 슬랙스", "black", ["formal"], "medium"),
    CandidateItem("essential", 19, "bottom", "블랙 트레이닝 팬츠", "black", ["sporty"], "medium"),
    CandidateItem("essential", 21, "shoes", "블랙 로퍼", "black", ["formal"], None),
    CandidateItem("essential", 23, "shoes", "블랙 러닝화", "black", ["sporty"], None),
    CandidateItem("essential", 26, "socks", "블랙 정장 양말", "black", ["formal"], "thin"),
    CandidateItem("essential", 27, "socks", "그레이 스포츠 양말", "gray", ["sporty"], "medium"),
)
SPORTY = ["e6", "e13", "e19", "e23", "e27"]
FORMAL = ["e3", "e8", "e14", "e21", "e26"]
FORMAL_WITHOUT_OUTER = ["e8", "e14", "e21"]


def kst(hour: int, minute: int = 0) -> datetime:
    return datetime(2026, 10, 3, hour, minute, tzinfo=KST)


COOL_WEATHER = WeatherInput(
    temperature=18.0,
    feels_like_temperature=17.2,
    precipitation=0.0,
    wind_speed=2.4,
    weather_condition_cd="clear",
    min_feels_like_temperature=15.1,
    hourly=(
        HourlyForecast(kst(11), 16.0, 15.1, 0.0, "clear"),
        HourlyForecast(kst(12), 17.0, 16.3, 0.0, "clear"),
        HourlyForecast(kst(13), 18.0, 17.2, 0.0, "cloudy"),
    ),
)
MILD_WEATHER = WeatherInput(
    temperature=20.0,
    feels_like_temperature=19.4,
    precipitation=0.0,
    wind_speed=1.8,
    weather_condition_cd="clear",
    min_feels_like_temperature=17.5,
    hourly=(
        HourlyForecast(kst(11), 18.5, 17.5, 0.0, "clear"),
        HourlyForecast(kst(12), 19.5, 18.6, 0.0, "clear"),
        HourlyForecast(kst(13), 20.0, 19.4, 0.0, "clear"),
    ),
)


def make_input(
    tpo_cd: str,
    tpo_text: str | None,
    outfits: list[ReviewTarget],
    *,
    weather: WeatherInput = COOL_WEATHER,
    is_outer_required: bool = True,
    candidates: tuple[CandidateItem, ...] = CANDIDATES,
) -> OutfitReviewInput:
    return OutfitReviewInput(
        weather=weather,
        going_out_start_at=kst(11, 30),
        going_out_end_at=kst(13),
        season_cd="fall",
        tpo_cd=tpo_cd,
        tpo_text=tpo_text,
        temperature_sensitivity_cd="normal",
        gender_cd="unisex",
        is_outer_required=is_outer_required,
        candidates=candidates,
        outfits=outfits,
    )


SCENARIOS = [
    (
        "격식(formal) 프리셋",
        make_input("formal", None, [ReviewTarget(1, SPORTY), ReviewTarget(2, FORMAL)]),
        {1: False, 2: True},
    ),
    (
        '직접 입력 "친구 결혼식 하객"',
        make_input("custom", "친구 결혼식 하객", [ReviewTarget(1, SPORTY)]),
        {1: False},
    ),
    (
        '직접 입력 "친구 결혼식 하객" + 후보에 아우터 없음',
        make_input(
            "custom",
            "친구 결혼식 하객",
            [ReviewTarget(1, FORMAL_WITHOUT_OUTER)],
            weather=MILD_WEATHER,
            is_outer_required=False,
            candidates=tuple(c for c in CANDIDATES if c.category_cd != "outer"),
        ),
        {1: True},
    ),
]


async def main() -> int:
    setup_logging()
    print(f"model: {get_settings().LLM_REVIEWER_MODEL}")
    llm = create_llm_client(get_settings())
    raw_outputs = []
    call_structured = llm.call_structured

    async def capture(*args, **kwargs):
        output = await call_structured(*args, **kwargs)
        raw_outputs.append(output)
        return output

    llm.call_structured = capture
    ok = True
    try:
        for title, data, expected in SCENARIOS:
            results = await review_outfits(llm, data)
            reasons = {r.outfit_seq: r.reason for r in raw_outputs[-1].reviews}
            print(f"\n[{title}]")
            for result in results:
                verdict = "pass" if result.passed else "fail"
                want = "pass" if expected[result.outfit_seq] else "fail"
                mark = "OK " if verdict == want else "NG "
                ok = ok and verdict == want
                print(f"  {mark}세트 {result.outfit_seq}: {verdict} (기대 {want})")
                print(f"      reason: {reasons[result.outfit_seq]}")
    finally:
        await llm.aclose()
    print("\n결과:", "기대와 일치" if ok else "기대와 다름")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
