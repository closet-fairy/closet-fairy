"""서버 로그로 추천 지표를 집계한다 (#13). LLM·DB는 쓰지 않는다.

서버 로그(JSON 줄)를 세션 id로 묶어 회차별 표와 전체 요약을 출력한다.
  - 평균 응답 시간: E2E 실행 기록(--e2e, scripts/recommendation_e2e.py의 JSON) 기준
  - 1차·2차 실패율, 후보 축소율, 재생성 횟수, 폴백 수: 서버 로그 기준
--e2e를 주면 그 기록에 있는 세션만 집계하고, 없으면 로그에 있는 세션을 모두 집계한다.

backend/ 폴더에서 실행한다:
    python scripts/aggregate_metrics.py e2e_server.log --e2e e2e_dev.json e2e_sparse.json
"""

from __future__ import annotations

import argparse
import json
import sys
import unicodedata
from dataclasses import dataclass
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.logging import Event  # noqa: E402
from app.services.outfit_generator import MAX_OUTFITS  # noqa: E402

RESPONSE_TIME_TARGET_S = 20.0
DENOMINATOR_NOTE = (
    "분모(요청 벌 수) = 세션별 처음 요청 벌 수(recommend.target_capped의 target, 없으면 "
    f"{MAX_OUTFITS}) + 재생성 요청 벌 수(recommend.regenerate의 regenerate_count) 합"
)
SOURCE_NOTE = "응답 시간은 E2E 실행 기록, 나머지는 서버 로그 기준"
TRACKED_EVENTS = frozenset(
    {
        Event.RECOMMEND_CANDIDATES,
        Event.RECOMMEND_TARGET_CAPPED,
        Event.RECOMMEND_REGENERATE,
        Event.RECOMMEND_FALLBACK,
        Event.HARD_RULE_FAIL,
        Event.REVIEWER_FAIL,
    }
)
HEADER = [
    ("세션", 6),
    ("옷", 4),
    ("룰 후", 5),
    ("후보", 4),
    ("축소율", 7),
    ("목표", 4),
    ("요청", 4),
    ("1차 실패", 8),
    ("2차 실패", 8),
    ("재생성", 6),
    ("폴백", 4),
    ("응답(s)", 7),
]


@dataclass
class SessionMetrics:
    session_id: int
    owned_count: int | None = None
    filtered_owned_count: int | None = None
    candidate_count: int | None = None
    target: int = MAX_OUTFITS
    regenerations: int = 0
    regenerate_count: int = 0
    hard_rule_fail: int = 0
    reviewer_fail: int = 0
    fallback_built: int = 0
    elapsed_s: float | None = None

    @property
    def requested(self) -> int:
        return self.target + self.regenerate_count

    @property
    def reduction_rate(self) -> float | None:
        if not self.owned_count or self.filtered_owned_count is None:
            return None
        return 1 - self.filtered_owned_count / self.owned_count


def read_log_lines(path: Path) -> list[str]:
    raw = path.read_bytes()
    # Windows PowerShell 5.1의 Tee-Object는 UTF-16으로 저장한다
    if raw.startswith((b"\xff\xfe", b"\xfe\xff")):
        content = raw.decode("utf-16", errors="replace")
    else:
        content = raw.decode("utf-8-sig", errors="replace")
    return content.splitlines()


def parse_events(lines: list[str]) -> list[dict]:
    events = []
    for line in lines:
        try:
            record = json.loads(line.strip())
        except json.JSONDecodeError:
            continue
        if isinstance(record, dict) and "event" in record:
            events.append(record)
    return events


def collect_sessions(events: list[dict]) -> dict[int, SessionMetrics]:
    sessions: dict[int, SessionMetrics] = {}
    for e in events:
        session_id = e.get("recommendation_session_id")
        if not session_id or e["event"] not in TRACKED_EVENTS:
            continue
        m = sessions.setdefault(session_id, SessionMetrics(session_id))
        event = e["event"]
        if event == Event.RECOMMEND_CANDIDATES:
            m.owned_count = e["owned_count"]
            m.filtered_owned_count = e["filtered_owned_count"]
            m.candidate_count = e["candidate_count"]
        elif event == Event.RECOMMEND_TARGET_CAPPED:
            m.target = e["target"]
        elif event == Event.RECOMMEND_REGENERATE:
            m.regenerations += 1
            m.regenerate_count += e["regenerate_count"]
        elif event == Event.HARD_RULE_FAIL:
            m.hard_rule_fail += 1
        elif event == Event.REVIEWER_FAIL:
            m.reviewer_fail += 1
        elif event == Event.RECOMMEND_FALLBACK:
            m.fallback_built += e["built"]
    return sessions


def load_e2e_elapsed(paths: list[Path]) -> dict[int, float | None]:
    elapsed: dict[int, float | None] = {}
    for path in paths:
        for run in json.loads(path.read_text(encoding="utf-8"))["runs"]:
            if "recommendation_session_id" in run:
                elapsed[run["recommendation_session_id"]] = run.get("elapsed_s")
    return elapsed


def select_sessions(
    sessions: dict[int, SessionMetrics], elapsed: dict[int, float | None] | None
) -> tuple[list[SessionMetrics], list[int]]:
    if elapsed is None:
        return [sessions[sid] for sid in sorted(sessions)], []
    selected, missing = [], []
    for sid in sorted(elapsed):
        if sid in sessions:
            sessions[sid].elapsed_s = elapsed[sid]
            selected.append(sessions[sid])
        else:
            missing.append(sid)
    return selected, missing


def _rate(numerator: int, denominator: int) -> float | None:
    return numerator / denominator if denominator else None


def _mean(values: list[float]) -> float | None:
    return sum(values) / len(values) if values else None


def summarize(sessions: list[SessionMetrics]) -> dict:
    requested = sum(m.requested for m in sessions)
    hard = sum(m.hard_rule_fail for m in sessions)
    review = sum(m.reviewer_fail for m in sessions)
    elapsed = [m.elapsed_s for m in sessions if m.elapsed_s is not None]
    reductions = [m.reduction_rate for m in sessions if m.reduction_rate is not None]
    candidates = [m.candidate_count for m in sessions if m.candidate_count is not None]
    regenerations = sum(m.regenerations for m in sessions)
    return {
        "session_count": len(sessions),
        "response_time_avg_s": _mean(elapsed),
        "response_time_max_s": max(elapsed) if elapsed else None,
        "response_time_over_target": sum(e > RESPONSE_TIME_TARGET_S for e in elapsed),
        "response_time_count": len(elapsed),
        "requested": requested,
        "hard_rule_fail": hard,
        "hard_rule_fail_rate": _rate(hard, requested),
        "reviewer_fail": review,
        "reviewer_fail_rate": _rate(review, requested),
        "reduction_rate_avg": _mean(reductions),
        "candidate_count_avg": _mean(candidates),
        "regenerations": regenerations,
        "regenerations_per_session": _rate(regenerations, len(sessions)),
        "fallback_built": sum(m.fallback_built for m in sessions),
    }


def llm_models(events: list[dict]) -> list[tuple[str, str, str]]:
    return sorted(
        {
            (e.get("call_name"), e.get("model"), e.get("prompt_version"))
            for e in events
            if e["event"] == Event.LLM_CALL
        },
        key=str,
    )


def _pct(value: float | None) -> str:
    return "-" if value is None else f"{value * 100:.1f}%"


def _num(value: object) -> str:
    return "-" if value is None else str(value)


def pad(text: str, width: int, align: str = ">") -> str:
    used = sum(2 if unicodedata.east_asian_width(c) in "WF" else 1 for c in text)
    fill = " " * max(width - used, 0)
    return fill + text if align == ">" else text + fill


def print_report(
    sessions: list[SessionMetrics],
    summary: dict,
    models: list[tuple[str, str, str]],
    missing: list[int],
) -> None:
    print(" ".join(pad(text, width) for text, width in HEADER))
    for m in sessions:
        print(
            f"{m.session_id:>6} {_num(m.owned_count):>4} {_num(m.filtered_owned_count):>5}"
            f" {_num(m.candidate_count):>4} {_pct(m.reduction_rate):>7} {m.target:>4}"
            f" {m.requested:>4} {m.hard_rule_fail:>8} {m.reviewer_fail:>8}"
            f" {m.regenerations:>6} {m.fallback_built:>4} {_num(m.elapsed_s):>7}"
        )
    if missing:
        print(f"\n경고: E2E 기록에는 있지만 로그에 없는 세션 {missing}")

    s = summary
    print(f"\n=== 전체 요약 (세션 {s['session_count']}개) ===")
    if s["response_time_count"]:
        print(
            f"평균 응답 시간: {s['response_time_avg_s']:.1f}초"
            f" (최대 {s['response_time_max_s']:.1f}초,"
            f" {RESPONSE_TIME_TARGET_S:.0f}초 초과 {s['response_time_over_target']}회,"
            f" {s['response_time_count']}회 기준)"
        )
    else:
        print("평균 응답 시간: E2E 실행 기록(--e2e)이 없어 계산하지 않음")
    print(f"1차 실패율: {s['hard_rule_fail']}/{s['requested']} = {_pct(s['hard_rule_fail_rate'])}")
    print(f"2차 실패율: {s['reviewer_fail']}/{s['requested']} = {_pct(s['reviewer_fail_rate'])}")
    print(f"  {DENOMINATOR_NOTE}")
    candidate_avg = s["candidate_count_avg"]
    print(
        f"후보 축소율(룰 전처리): 평균 {_pct(s['reduction_rate_avg'])}"
        f" (보충 후 후보 평균 {'-' if candidate_avg is None else f'{candidate_avg:.1f}'}개)"
    )
    per_session = s["regenerations_per_session"]
    print(
        f"재생성: 총 {s['regenerations']}회,"
        f" 세션당 {'-' if per_session is None else f'{per_session:.2f}'}회"
    )
    print(f"폴백: 총 {s['fallback_built']}벌")
    print(f"* {SOURCE_NOTE}")
    if models:
        print("\nLLM 호출 모델 (로그 전체 기준):")
        for call_name, model, version in models:
            print(f"  {call_name}: {model} / 프롬프트 {version}")


def main() -> int:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawTextHelpFormatter
    )
    parser.add_argument("log", type=Path, help="서버 로그 파일 (JSON 줄)")
    parser.add_argument("--e2e", type=Path, nargs="+", help="recommendation_e2e.py의 JSON 결과")
    args = parser.parse_args()

    events = parse_events(read_log_lines(args.log))
    elapsed = load_e2e_elapsed(args.e2e) if args.e2e else None
    sessions, missing = select_sessions(collect_sessions(events), elapsed)
    if not sessions:
        print("집계할 세션이 없습니다. 로그 파일과 --e2e 기록을 확인하세요.", file=sys.stderr)
        return 1
    print_report(sessions, summarize(sessions), llm_models(events), missing)
    return 0


if __name__ == "__main__":
    sys.exit(main())
