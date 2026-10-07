"""추천 시나리오 실행 스크립트. 실제 LLM을 호출한다 (비용 발생).

날씨·계절·TPO·외출 시간을 시나리오 값으로 고정하고, 옷장과 개인 설정은 DB에서 읽어
추천 파이프라인(recommend)을 끝까지 돌린다. 결과는 저장하지 않는다.

backend/ 폴더에서 실행한다 (DB가 떠 있어야 하고 .env의 ANTHROPIC_API_KEY가 필요하다):
    python scripts/run_scenario.py transition_work --member-id 1
    python scripts/run_scenario.py all --member-id 1 --runs 3 --json scenario_result.json
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
import time
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import get_settings  # noqa: E402
from app.core.db import AsyncSessionLocal  # noqa: E402
from app.core.logging import setup_logging  # noqa: E402
from app.repositories import clothing as clothing_repo  # noqa: E402
from app.repositories import member_setting as member_setting_repo  # noqa: E402
from app.services.llm import create_llm_client  # noqa: E402
from app.services.recommend_context import RecommendContext  # noqa: E402
from app.services.recommendation_pipeline import RecommendOutcome, recommend  # noqa: E402
from app.services.weather.base_time import KST  # noqa: E402
from app.services.weather.feels_like import feels_like  # noqa: E402
from app.services.weather.weather_service import HourlyWeather, WeatherResult  # noqa: E402


@dataclass(frozen=True)
class Scenario:
    name: str
    description: str
    season_cd: str
    tpo_cd: str
    start_hour: int
    end_hour: int
    # (시각, 기온, 풍속, 날씨 상태, 강수량) — 외출 시간대를 덮어야 한다
    hourly: list[tuple[int, float, float, str, float]]
    tpo_text: str | None = None


SCENARIOS = {
    "transition_work": Scenario(
        name="transition_work",
        description="간절기 출근: 아침은 쌀쌀하고 낮은 따뜻한 10월",
        season_cd="fall",
        tpo_cd="work",
        start_hour=8,
        end_hour=19,
        hourly=[
            (h, t, 2.5, "clear", 0.0)
            for h, t in zip(
                range(8, 20), [9, 11, 14, 17, 19, 20, 21, 21, 20, 18, 16, 14], strict=True
            )
        ],
    ),
    "rainy_outing": Scenario(
        name="rainy_outing",
        description="비 오는 날 외출: 오후 내내 비 예보",
        season_cd="fall",
        tpo_cd="daily",
        start_hour=13,
        end_hour=18,
        hourly=[(h, 17.0, 3.0, "rain", 2.0) for h in range(13, 19)],
    ),
    "summer_wedding": Scenario(
        name="summer_wedding",
        description="여름 결혼식 하객: 한낮 30도, 격식 TPO",
        season_cd="summer",
        tpo_cd="formal",
        start_hour=11,
        end_hour=16,
        hourly=[(h, 30.0, 1.5, "clear", 0.0) for h in range(11, 17)],
    ),
    "winter_daily": Scenario(
        name="winter_daily",
        description="한겨울 데일리: 옷장이 적은 회원으로 돌리면 에센셜 보충을 확인할 수 있다",
        season_cd="winter",
        tpo_cd="daily",
        start_hour=10,
        end_hour=18,
        hourly=[(h, -3.0, 3.5, "overcast", 0.0) for h in range(10, 19)],
    ),
}


def build_weather(scenario: Scenario, day: datetime) -> WeatherResult:
    hourly = [
        HourlyWeather(
            at=day.replace(hour=hour),
            temperature=temp,
            feels_like_temperature=feels_like(temp, wind),
            precipitation=rain,
            wind_speed=wind,
            weather_condition_cd=condition,
        )
        for hour, temp, wind, condition, rain in scenario.hourly
    ]
    first = hourly[0]
    return WeatherResult(
        temperature=first.temperature,
        feels_like_temperature=first.feels_like_temperature,
        precipitation=first.precipitation,
        wind_speed=first.wind_speed,
        weather_condition_cd=first.weather_condition_cd,
        min_feels_like_temperature=min(h.feels_like_temperature for h in hourly),
        hourly=hourly,
    )


async def build_context(scenario: Scenario, member_id: int) -> RecommendContext:
    day = (datetime.now(KST) + timedelta(days=1)).replace(minute=0, second=0, microsecond=0)
    async with AsyncSessionLocal() as db:
        setting = await member_setting_repo.get_member_setting(db, member_id)
        preferred_styles = (
            await member_setting_repo.get_preferred_styles(db, setting.member_setting_id)
            if setting
            else []
        )
        clothing = await clothing_repo.get_completed_clothing(db, member_id)
    return RecommendContext(
        recommendation_session_id=0,
        member_id=member_id,
        going_out_start_at=day.replace(hour=scenario.start_hour),
        going_out_end_at=day.replace(hour=scenario.end_hour),
        season_cd=scenario.season_cd,
        tpo_cd=scenario.tpo_cd,
        tpo_text=scenario.tpo_text,
        tpo_input_type_cd="custom" if scenario.tpo_cd == "custom" else "preset",
        weather=build_weather(scenario, day),
        birth_year=setting.birth_year if setting else None,
        temperature_sensitivity_cd=setting.temperature_sensitivity_cd if setting else None,
        gender_cd=setting.gender_cd if setting else "unisex",
        preferred_styles=preferred_styles,
        clothing=clothing,
    )


def summarize(scenario: Scenario, outcome: RecommendOutcome, elapsed_s: float) -> dict:
    names = {
        c.key: f"{c.item_name or '-'} ({c.category_cd})" for c in outcome.prompt_input.candidates
    }
    generation = outcome.generation
    return {
        "scenario": scenario.name,
        "description": scenario.description,
        "elapsed_s": round(elapsed_s, 1),
        "metrics": {
            "owned_count": outcome.owned_count,
            "after_rule_filter": outcome.filtered_owned_count,
            "candidate_count": len(outcome.prompt_input.candidates),
            "is_clothing_shortage": outcome.supplement.is_clothing_shortage,
            "outer_requirement": outcome.supplement.outer_requirement,
            "rounds": generation.rounds,
            "hard_rule_retries": generation.hard_rule_retries,
            "reviewer_retries": generation.reviewer_retries,
            "shortfall_retries": generation.shortfall_retries,
            "fallback_count": generation.fallback_count,
        },
        "exploration_style": outcome.prompt_input.exploration_style,
        "outfits": [
            {
                "outfit_seq": o.outfit_seq,
                "outfit_type": o.outfit_type,
                "is_fallback": o.is_fallback,
                "items": [names.get(key, f"{key} (후보에 없음)") for key in o.item_keys],
                "reason": o.reason,
            }
            for o in generation.outfits
        ],
    }


def print_summary(summary: dict) -> None:
    m = summary["metrics"]
    print(f"\n=== {summary['scenario']} — {summary['description']} ({summary['elapsed_s']}초)")
    print(
        f"옷 {m['owned_count']}벌 → 룰 전처리 후 {m['after_rule_filter']}벌"
        f" → 후보 {m['candidate_count']}개"
        f" | 의류 부족 {m['is_clothing_shortage']} | 아우터 {m['outer_requirement']}"
    )
    print(
        f"라운드 {m['rounds']} | 1차 재시도 {m['hard_rule_retries']}"
        f" | 2차 재시도 {m['reviewer_retries']}"
        f" | 생성 부족 재시도 {m['shortfall_retries']} | 폴백 {m['fallback_count']}"
        f" | 탐색 스타일 {summary['exploration_style']}"
    )
    for outfit in summary["outfits"]:
        tag = " [폴백]" if outfit["is_fallback"] else ""
        print(f"  세트 {outfit['outfit_seq']} ({outfit['outfit_type']}){tag}")
        print(f"    {', '.join(outfit['items'])}")
        print(f"    사유: {outfit['reason']}")


async def main() -> int:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawTextHelpFormatter
    )
    parser.add_argument("scenario", choices=[*SCENARIOS, "all"])
    parser.add_argument("--member-id", type=int, default=get_settings().DEV_MEMBER_ID)
    parser.add_argument("--runs", type=int, default=1, help="시나리오마다 반복 실행 횟수")
    parser.add_argument("--json", type=Path, help="결과를 JSON 파일로도 저장")
    args = parser.parse_args()

    setup_logging()
    scenarios = list(SCENARIOS.values()) if args.scenario == "all" else [SCENARIOS[args.scenario]]
    llm = create_llm_client(get_settings())
    results = []
    try:
        for scenario in scenarios:
            for _ in range(args.runs):
                context = await build_context(scenario, args.member_id)
                started = time.perf_counter()
                outcome = await recommend(context, llm)
                summary = summarize(scenario, outcome, time.perf_counter() - started)
                print_summary(summary)
                results.append(summary)
    finally:
        await llm.aclose()

    if args.json:
        args.json.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"\nJSON 저장: {args.json}")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
