"""추천 E2E 검증 스크립트 (#13). 떠 있는 서버의 API를 HTTP로 호출한다.
실제 LLM이 호출된다 (비용 발생).

회차마다 세션을 만들고(POST /recommendation-sessions) 결과를 폴링해(GET) completed·failed까지
걸린 시간을 잰다. 그리고 아래를 검사·기록한 뒤 세션을 취소한다.
  - 코디 3벌 이상인지
  - 저장된 코디 아이템이 실제 옷(그 회원의 처리 완료된 옷)·활성 에센셜을 가리키는지 (DB 조회)
  - 의류 부족 표시가 회원에 맞는지(개발테스터 false, 부족테스터 true), 날씨 대체값 여부
--rate N이면 마지막 N회는 취소 대신 첫 코디에 별점을 매긴다. 별점은 선호 점수를 바꿔 뒤 회차에
영향을 주므로 기본값은 0이다.

API는 서버의 DEV_MEMBER_ID 회원으로만 동작한다. 회원(--member)마다 서버를 다시 띄워 따로 돌린다.

실행 순서 (backend/ 폴더):
  1. 부족테스터 시드. 처음 한 번, 또는 부족테스터를 시드 직후 상태로 되돌릴 때 (Git Bash):
       docker compose exec -T db mysql -uroot -p"${MYSQL_ROOT_PASSWORD:-dev}" fashion \\
         --default-character-set=utf8mb4 < db/seeds/006_dev_sparse_member.sql
     개발테스터 옷장이 비어 있으면 005_dev_closet.sql도 같은 방식으로 실행한다.
     부족테스터 id 조회:
       SELECT member_id FROM member
       WHERE provider_cd = 'google' AND provider_user_id_hash = UNHEX(SHA2('dev-google-0002', 256));
  2. 처음부터 다시 돌릴 때는 개발테스터의 세션을 지우고 선호 점수를 시드 직후 상태로 되돌린다.
     정산된 세션 수가 탐색 스타일 선정(UCB)에 쓰이므로 세션도 지운다:
       SET @m = (SELECT member_id FROM member WHERE provider_cd = 'google'
                 AND provider_user_id_hash = UNHEX(SHA2('dev-google-0001', 256)));
       DELETE FROM recommendation_session WHERE member_id = @m;
       UPDATE preference_score SET score_sum = 0, exposure_count = 0, initial_bonus_at = NULL
       WHERE member_id = @m;
       UPDATE preference_score ps
       JOIN member_setting ms ON ms.member_id = @m
       JOIN member_setting_style mss
         ON mss.member_setting_id = ms.member_setting_id AND mss.style_cd = ps.attribute_value
       SET ps.score_sum = 5.00, ps.initial_bonus_at = UTC_TIMESTAMP()
       WHERE ps.member_id = @m AND ps.attribute_type_cd = 'style';
  3. 서버를 로그 파일로 남기며 띄운다 (PowerShell). 한글이 깨지지 않게 인코딩을 맞춘다:
       [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
       $env:PYTHONIOENCODING = "utf-8"
       python -m uvicorn app.main:app | Tee-Object -FilePath e2e_server.log
  4. 다른 창에서 개발테스터 6회:
       python scripts/recommendation_e2e.py --member dev --json e2e_dev.json
  5. .env의 DEV_MEMBER_ID를 부족테스터 id로 바꾸고 서버를 다시 띄운다 (로그는 이어 붙인다):
       python -m uvicorn app.main:app | Tee-Object -FilePath e2e_server.log -Append
     부족테스터 4회:
       python scripts/recommendation_e2e.py --member sparse --json e2e_sparse.json
  6. 집계:
       python scripts/aggregate_metrics.py e2e_server.log --e2e e2e_dev.json e2e_sparse.json
  7. 끝나면 .env의 DEV_MEMBER_ID를 원래 값으로 되돌린다.

비 오는 날: 실제 날씨로는 비 오는 날을 고를 수 없다. rainy 회차는 TPO만 비 오는 날이고 날씨는 실제
값이다. 비 예보 날씨는 아래로 따로 확인하고, 이 결과는 API를 거치지 않은 것(날씨 고정, 저장·폴링
없음)이므로 실제 API 결과와 구분해 밝힌다:
       python scripts/run_scenario.py rainy_outing
"""

from __future__ import annotations

import argparse
import asyncio
import json
import subprocess
import sys
import time
from dataclasses import dataclass
from datetime import datetime, timedelta
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import text  # noqa: E402
from sqlalchemy.exc import SQLAlchemyError  # noqa: E402

from app.core.config import Settings, get_settings  # noqa: E402
from app.core.db import engine  # noqa: E402
from app.services import outfit_generator, reviewer  # noqa: E402
from app.services.prompt import (  # noqa: E402
    load_prompt_template,
    outfit_generation,
    outfit_review,
)
from app.services.weather.base_time import KST  # noqa: E402
from scripts.aggregate_metrics import RESPONSE_TIME_TARGET_S, pad  # noqa: E402

MIN_OUTFITS = 3
POLL_INTERVAL_S = 0.5
POLL_TIMEOUT_S = 120.0
# 요청이 서버에 닿기 전에 시작 시각이 지나 거절되지 않게 여유를 둔다
START_MARGIN = timedelta(minutes=10)
RATING = 4
PARTY_TEXT = "친구 생일 파티, 저녁 루프탑 레스토랑"
RUN_HEADER = [
    ("#", 2, ">"),
    ("시나리오", 17, "<"),
    ("세션", 6, ">"),
    ("시간(s)", 7, ">"),
    ("상태", 10, "<"),
    ("벌수", 4, ">"),
    ("없는id", 6, ">"),
    ("에센셜", 6, ">"),
    ("부족", 5, "<"),
    ("날씨대체", 8, "<"),
    ("종료", 7, "<"),
    ("판정", 0, "<"),
]


@dataclass(frozen=True)
class Member:
    label: str
    provider_user_id: str
    is_clothing_shortage: bool


MEMBERS = {
    "dev": Member("개발테스터", "dev-google-0001", is_clothing_shortage=False),
    "sparse": Member("부족테스터", "dev-google-0002", is_clothing_shortage=True),
}


@dataclass(frozen=True)
class Scenario:
    name: str
    tpo_cd: str
    hours: int
    tpo_text: str | None = None


SCENARIOS = {
    "dev": [
        Scenario("daily", "daily", 6),
        Scenario("work", "work", 9),
        Scenario("formal", "formal", 4),
        Scenario("rainy", "rainy", 6),
        Scenario("custom_party", "custom", 4, PARTY_TEXT),
        Scenario("custom_interview", "custom", 3, "IT 회사 면접"),
    ],
    "sparse": [
        Scenario("daily", "daily", 6),
        Scenario("formal", "formal", 4),
        Scenario("rainy", "rainy", 6),
        Scenario("custom_party", "custom", 4, PARTY_TEXT),
    ],
}

MEMBER_ID_SQL = text(
    """
    SELECT member_id FROM member
    WHERE provider_cd = 'google' AND provider_user_id_hash = UNHEX(SHA2(:provider_user_id, 256))
    """
)

SESSION_MEMBER_SQL = text(
    "SELECT member_id FROM recommendation_session WHERE recommendation_session_id = :session_id"
)

SAVED_ITEMS_SQL = text(
    """
    SELECT
      COUNT(DISTINCT o.outfit_id) AS outfit_count,
      COALESCE(SUM(
        (oi.item_source_cd = 'owned'
          AND (c.clothing_id IS NULL OR c.member_id <> :member_id
               OR c.processing_status_cd <> 'completed'))
        OR (oi.item_source_cd = 'essential'
          AND (e.essential_item_id IS NULL OR NOT e.is_active))
      ), 0) AS invalid_item_count
    FROM recommendation_deck d
    JOIN outfit o ON o.recommendation_deck_id = d.recommendation_deck_id
    LEFT JOIN outfit_item oi ON oi.outfit_id = o.outfit_id
    LEFT JOIN clothing c ON c.clothing_id = oi.clothing_id
    LEFT JOIN essential_item e ON e.essential_item_id = oi.essential_item_id
    WHERE d.recommendation_session_id = :session_id
    """
)


class PreflightError(Exception):
    pass


def going_out_window(now: datetime, hours: int) -> tuple[datetime, datetime]:
    earliest = now + START_MARGIN
    start = earliest.replace(minute=0, second=0, microsecond=0)
    while start < earliest:
        start += timedelta(minutes=30)
    if start.date() != now.date():
        raise PreflightError(
            "외출 시작 시각이 내일로 넘어갑니다. API는 오늘 날짜 기준이라 자정 직전에는 "
            "실행할 수 없습니다. 자정이 지난 뒤 다시 실행하세요."
        )
    return start, start + timedelta(hours=hours)


async def find_member_id(member: Member) -> int | None:
    async with engine.connect() as conn:
        result = await conn.execute(MEMBER_ID_SQL, {"provider_user_id": member.provider_user_id})
        return result.scalar_one_or_none()


async def find_session_member_id(session_id: int) -> int | None:
    async with engine.connect() as conn:
        result = await conn.execute(SESSION_MEMBER_SQL, {"session_id": session_id})
        return result.scalar_one_or_none()


async def check_saved_items(session_id: int, member_id: int) -> tuple[int, int]:
    async with engine.connect() as conn:
        row = (
            await conn.execute(SAVED_ITEMS_SQL, {"session_id": session_id, "member_id": member_id})
        ).one()
    return int(row.outfit_count), int(row.invalid_item_count)


async def preflight(
    member_key: str, settings: Settings, client: httpx.AsyncClient
) -> tuple[Member, int]:
    member = MEMBERS[member_key]
    if not settings.ANTHROPIC_API_KEY:
        raise PreflightError(
            ".env의 ANTHROPIC_API_KEY가 비어 있습니다. 키를 넣고 서버를 다시 띄우세요."
        )
    try:
        member_id = await find_member_id(member)
    except (SQLAlchemyError, OSError) as e:
        raise PreflightError(
            f"DB에 연결할 수 없습니다 ({type(e).__name__}). "
            "docker compose up -d db 로 DB를 띄웠는지, .env의 DATABASE_URL을 확인하세요."
        ) from e
    if member_id is None:
        how = (
            "bash scripts/seed.sh 로 시드를 넣으세요."
            if member_key == "dev"
            else "이 파일 docstring의 실행 순서 1(006 시드)을 실행하세요."
        )
        raise PreflightError(f"{member.label}({member.provider_user_id})가 DB에 없습니다. {how}")
    if settings.DEV_MEMBER_ID != member_id:
        raise PreflightError(
            f".env의 DEV_MEMBER_ID={settings.DEV_MEMBER_ID}가 {member.label} id {member_id}와 "
            f"다릅니다. DEV_MEMBER_ID={member_id}로 바꾸고 서버를 다시 띄우세요."
        )
    try:
        response = await client.get("/health")
    except httpx.TransportError as e:
        raise PreflightError(
            f"{client.base_url}에 연결할 수 없습니다 ({type(e).__name__}). "
            "서버를 띄웠는지 확인하세요 (docstring 실행 순서 3)."
        ) from e
    if response.status_code != 200:
        raise PreflightError(f"GET /health가 {response.status_code}를 돌려줬습니다.")
    if not settings.KMA_SERVICE_KEY:
        print(
            "경고: .env의 KMA_SERVICE_KEY가 비어 있습니다. 날씨가 대체값으로 추천됩니다.",
            file=sys.stderr,
        )
    return member, member_id


async def poll(client: httpx.AsyncClient, session_id: int) -> dict:
    deadline = time.perf_counter() + POLL_TIMEOUT_S
    while True:
        response = await client.get(f"/recommendation-sessions/{session_id}")
        response.raise_for_status()
        data = response.json()
        if data["generation_status_cd"] != "processing" or time.perf_counter() >= deadline:
            return data
        await asyncio.sleep(POLL_INTERVAL_S)


async def end_session(
    client: httpx.AsyncClient, session_id: int, outfits: list[dict], rate: bool
) -> tuple[str, int]:
    if rate and outfits:
        response = await client.post(
            f"/recommendation-sessions/{session_id}/rating",
            json={"outfit_id": outfits[0]["outfit_id"], "rating": RATING},
        )
        return "rating", response.status_code
    response = await client.post(f"/recommendation-sessions/{session_id}/cancel")
    return "cancel", response.status_code


def request_body(scenario: Scenario, start: datetime, end: datetime, args) -> dict:
    return {
        "sido_nm": args.sido,
        "sigungu_nm": args.sigungu,
        "location_input_type_cd": "manual",
        "tpo_cd": scenario.tpo_cd,
        "tpo_text": scenario.tpo_text,
        "going_out_start_time": start.strftime("%H:%M"),
        "going_out_end_time": end.strftime("%H:%M"),
    }


async def run_one(
    client: httpx.AsyncClient,
    scenario: Scenario,
    member: Member,
    member_id: int,
    rate: bool,
    args,
) -> dict:
    start, end = going_out_window(datetime.now(KST), scenario.hours)
    run = {
        "scenario": scenario.name,
        "tpo_cd": scenario.tpo_cd,
        "tpo_text": scenario.tpo_text,
        "going_out": f"{start:%H:%M}-{end:%H:%M}",
    }
    started = time.perf_counter()
    response = await client.post(
        "/recommendation-sessions", json=request_body(scenario, start, end, args)
    )
    if response.status_code != 202:
        return {
            **run,
            "passed": False,
            "failures": [f"POST {response.status_code}"],
            "error": response.text,
        }
    session_id = response.json()["recommendation_session_id"]
    run["recommendation_session_id"] = session_id

    # 스크립트가 읽은 .env와 서버가 띄워질 때 읽은 .env가 다를 수 있다
    owner_id = await find_session_member_id(session_id)
    if owner_id != member_id:
        await client.post(f"/recommendation-sessions/{session_id}/cancel")
        raise PreflightError(
            f"서버가 회원 id {owner_id}로 세션을 만들었습니다. 서버가 읽은 DEV_MEMBER_ID가 "
            f"{member.label} id {member_id}와 다릅니다. "
            ".env를 바꾼 뒤 서버를 다시 띄웠는지 확인하세요."
        )

    data = await poll(client, session_id)
    elapsed_s = round(time.perf_counter() - started, 1)
    outfits = data["outfits"]
    weather = data["weather"] or {}
    # 취소하면 코디가 지워지므로 세션을 끝내기 전에 검사한다
    db_outfit_count, invalid_item_count = await check_saved_items(session_id, member_id)
    ended_by, end_status_code = await end_session(client, session_id, outfits, rate)

    status = data["generation_status_cd"]
    failures = []
    if status != "completed":
        failures.append("timeout" if status == "processing" else status)
    if len(outfits) < MIN_OUTFITS:
        failures.append(f"{MIN_OUTFITS}벌 미만")
    if invalid_item_count:
        failures.append("없는 item_id")
    if db_outfit_count != len(outfits):
        failures.append("API·DB 코디 수 다름")
    if data["is_clothing_shortage"] != member.is_clothing_shortage:
        failures.append("의류 부족 표시가 기대와 다름")
    if end_status_code != 200:
        failures.append(f"{ended_by} {end_status_code}")

    return {
        **run,
        "elapsed_s": elapsed_s,
        "generation_status_cd": status,
        "outfit_count": len(outfits),
        "db_outfit_count": db_outfit_count,
        "invalid_item_count": invalid_item_count,
        "essential_item_count": sum(
            item["item_source_cd"] == "essential" for o in outfits for item in o["items"]
        ),
        "is_clothing_shortage": data["is_clothing_shortage"],
        "weather_is_fallback": weather.get("is_fallback"),
        "weather_condition_cd": weather.get("weather_condition_cd"),
        "temperature": weather.get("temperature"),
        "ended_by": ended_by,
        "end_status_code": end_status_code,
        "passed": not failures,
        "failures": failures,
    }


def git_commit() -> str:
    try:
        sha = subprocess.run(
            ["git", "rev-parse", "HEAD"], capture_output=True, text=True, check=True
        ).stdout.strip()
        dirty = subprocess.run(
            ["git", "status", "--porcelain"], capture_output=True, text=True, check=True
        ).stdout.strip()
    except (OSError, subprocess.CalledProcessError):
        return "unknown"
    return f"{sha}-dirty" if dirty else sha


def build_meta(settings: Settings, member: Member, member_id: int, args) -> dict:
    return {
        "started_at": datetime.now(KST).isoformat(timespec="seconds"),
        "git_commit": git_commit(),
        "generation_model": settings.LLM_MODEL_OVERRIDES.get(
            outfit_generator.CALL_NAME, settings.LLM_DEFAULT_MODEL
        ),
        "review_model": settings.LLM_REVIEWER_MODEL,
        "generation_prompt_version": load_prompt_template(
            outfit_generation.PROMPT_NAME, outfit_generation.PROMPT_VERSION
        ).prompt_version,
        "review_prompt_version": load_prompt_template(
            outfit_review.PROMPT_NAME, outfit_review.PROMPT_VERSION
        ).prompt_version,
        "review_call_name": reviewer.CALL_NAME,
        "member": member.label,
        "member_id": member_id,
        "base_url": args.base_url,
        "location": f"{args.sido} {args.sigungu}",
        "rate_last": args.rate,
    }


def print_runs(runs: list[dict]) -> None:
    print()
    print(" ".join(pad(text, width, align) for text, width, align in RUN_HEADER))
    for i, r in enumerate(runs, 1):
        verdict = "통과" if r["passed"] else "실패: " + ", ".join(r["failures"])
        print(
            f"{i:>2} {r['scenario']:<17} {r.get('recommendation_session_id', '-')!s:>6}"
            f" {r.get('elapsed_s', '-')!s:>7} {r.get('generation_status_cd', '-'):<10}"
            f" {r.get('outfit_count', '-')!s:>4} {r.get('invalid_item_count', '-')!s:>6}"
            f" {r.get('essential_item_count', '-')!s:>6} {r.get('is_clothing_shortage', '-')!s:<5}"
            f" {r.get('weather_is_fallback', '-')!s:<8} {r.get('ended_by', '-'):<7} {verdict}"
        )
    elapsed = [r["elapsed_s"] for r in runs if "elapsed_s" in r]
    passed = sum(r["passed"] for r in runs)
    print(f"\n통과 {passed}/{len(runs)}회")
    if elapsed:
        over = sum(e > RESPONSE_TIME_TARGET_S for e in elapsed)
        print(
            f"응답 시간 평균 {sum(elapsed) / len(elapsed):.1f}초, 최대 {max(elapsed):.1f}초,"
            f" {RESPONSE_TIME_TARGET_S:.0f}초 초과 {over}회"
        )


async def main() -> int:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawTextHelpFormatter
    )
    parser.add_argument("--member", choices=list(MEMBERS), required=True)
    parser.add_argument("--only", help="쉼표로 구분한 시나리오 이름만 실행")
    parser.add_argument("--rate", type=int, default=0, help="마지막 N회는 취소 대신 별점")
    parser.add_argument("--base-url", default="http://127.0.0.1:8000")
    parser.add_argument("--sido", default="서울특별시")
    parser.add_argument("--sigungu", default="성동구")
    parser.add_argument("--json", type=Path, help="결과를 JSON 파일로도 저장")
    args = parser.parse_args()

    scenarios = SCENARIOS[args.member]
    if args.only:
        names = args.only.split(",")
        unknown = set(names) - {s.name for s in scenarios}
        if unknown:
            parser.error(f"{args.member}에 없는 시나리오: {', '.join(sorted(unknown))}")
        scenarios = [s for s in scenarios if s.name in names]
    if not 0 <= args.rate <= len(scenarios):
        parser.error(f"--rate는 0~{len(scenarios)} 사이여야 합니다.")

    settings = get_settings()
    runs: list[dict] = []
    meta: dict = {}
    try:
        async with httpx.AsyncClient(base_url=args.base_url, timeout=10.0) as client:
            member, member_id = await preflight(args.member, settings, client)
            meta = build_meta(settings, member, member_id, args)
            rate_from = len(scenarios) - args.rate
            for i, scenario in enumerate(scenarios):
                print(f"[{i + 1}/{len(scenarios)}] {scenario.name} 실행 중...", flush=True)
                runs.append(
                    await run_one(client, scenario, member, member_id, i >= rate_from, args)
                )
    except PreflightError as e:
        print(f"중단: {e}", file=sys.stderr)
        return 2
    finally:
        await engine.dispose()
        if args.json and runs:
            args.json.write_text(
                json.dumps({"meta": meta, "runs": runs}, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
            print(f"\nJSON 저장: {args.json}")

    print_runs(runs)
    return 0 if all(r["passed"] for r in runs) else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
