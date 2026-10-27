"""서버 로그로 추천 지표를 집계한다 (#13). LLM·DB는 쓰지 않는다.

서버 로그(JSON 줄)를 세션 id로 묶어 회차별 표와 전체 요약을 출력한다.
  - 평균 응답 시간: E2E 실행 기록(--e2e, scripts/recommendation_e2e.py의 JSON) 기준.
    completed 회차만 평균에 넣고, 미완료(processing·failed) 회차는 따로 센다
  - 1차·2차 실패율, 후보 축소율, 재생성 횟수, 폴백 수: 서버 로그 기준
--e2e를 주면 그 기록에 있는 세션만 집계하고, 없으면 로그에 있는 세션을 모두 집계한다.

재추천도 같은 세션 id로 검증 로그를 남기므로 request_id로 나눈다. 백그라운드 작업의 로그는 그 작업을
띄운 POST와 request_id가 같아서, regeneration.requested와 request_id가 같은 로그는 첫 추천에서 뺀다.
같은 재추천 요청의 접수 로그와 끝 로그(completed·failed·discarded)의 request_id가 다르면 이렇게 나눌
수 없으므로 경고를 출력한다.

재추천 로그가 있으면 === 재추천 === 절을 덧붙인다. 재추천 요청 하나를 request_id 하나로 묶는다.
  - 이해 못 함 비율 = unclear / (접수 + 파싱까지 간 거절: unclear·harmful_intent·intent_refused·
    intent_failed). in_progress·empty·too_long·harmful_input은 분모에서 뺀다
  - 재추천 실패율 = failed / (completed + failed). discarded·timed_out은 따로 센다
  - 1차·2차 실패율 분모 = 요청별 목표 벌 수 + regenerate_count 합
  - 응답 시간·의도적 예외는 E2E 기록(scripts/regeneration_e2e.py의 JSON regenerations[])에서
    request_id로 맞춰 읽는다. 쓰는 필드: request_id, intentional, final_status, elapsed_s,
    post_status, error_code. --e2e를 주면 그 기록에 있는 request_id만 집계하고, 이해 못 함
    비율과 실패율을 전체와 의도적 예외 제외 두 줄로 출력한다

backend/ 폴더에서 실행한다:
    python scripts/aggregate_metrics.py e2e_server.log --e2e e2e_dev.json e2e_sparse.json
"""

from __future__ import annotations

import argparse
import json
import sys
import unicodedata
from collections import Counter
from collections.abc import Sequence
from dataclasses import dataclass, field
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.logging import Event  # noqa: E402
from app.services.outfit_generator import MAX_OUTFITS  # noqa: E402
from app.services.regeneration_intent import CALL_NAME as INTENT_CALL_NAME  # noqa: E402

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
REGENERATION_END_EVENTS = frozenset(
    {Event.REGENERATION_COMPLETED, Event.REGENERATION_FAILED, Event.REGENERATION_DISCARDED}
)
REGENERATION_OUTCOMES = {
    Event.REGENERATION_COMPLETED: "completed",
    Event.REGENERATION_FAILED: "failed",
    Event.REGENERATION_DISCARDED: "discarded",
}
PARSED_REJECT_REASONS = frozenset({"unclear", "harmful_intent", "intent_refused", "intent_failed"})
E2E_ONLY_CODES = (
    "SESSION_NOT_READY",
    "SESSION_ENDED",
    "SESSION_ALREADY_SETTLED",
    "REGENERATION_TARGET_NOT_LATEST",
)
UNCLEAR_NOTE = "분모 = 접수 + 파싱까지 간 거절(unclear·harmful_intent·intent_refused·intent_failed)"
FAILURE_NOTE = "분모 = completed + failed"
REGENERATION_DENOMINATOR_NOTE = (
    "분모(요청 벌 수) = 요청별 목표 벌 수(recommend.target_capped의 target, 없으면 전체 "
    f"{MAX_OUTFITS}·세트 하나 1, 바꿀 후보 없음 0) + 재생성 요청 벌 수(regenerate_count) 합"
)
REGENERATION_HEADER = [
    ("요청id", 6),
    ("세션", 6),
    ("범위", 6),
    ("결과", 14),
    ("파싱(ms)", 8),
    ("생성(ms)", 8),
    ("LLM", 4),
    ("요청", 4),
    ("1차 실패", 8),
    ("2차 실패", 8),
    ("재생성", 6),
    ("응답(s)", 7),
    ("예외", 4),
]
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
    generation_status_cd: str | None = None

    @property
    def requested(self) -> int:
        return self.target + self.regenerate_count

    @property
    def reduction_rate(self) -> float | None:
        if not self.owned_count or self.filtered_owned_count is None:
            return None
        return 1 - self.filtered_owned_count / self.owned_count


@dataclass
class RegenerationMetrics:
    regeneration_request_id: int
    request_id: str
    session_id: int | None = None
    target_scope_cd: str | None = None
    has_target_slot: bool = False
    outcome: str | None = None
    reason: str | None = None
    no_alternative: bool = False
    rounds: int | None = None
    target: int | None = None
    regenerations: int = 0
    regenerate_count: int = 0
    hard_rule_fail: int = 0
    reviewer_fail: int = 0
    generation_ms: int | None = None
    intent_ms: float | None = None
    llm_calls: int = 0
    elapsed_s: float | None = None
    intentional: bool = False

    @property
    def scope(self) -> str:
        if self.target_scope_cd == "all":
            return "all"
        return "parts" if self.has_target_slot else "single"

    @property
    def requested(self) -> int:
        if self.no_alternative:
            return 0
        if self.target is not None:
            target = self.target
        else:
            target = MAX_OUTFITS if self.target_scope_cd == "all" else 1
        return target + self.regenerate_count

    @property
    def failure_kind(self) -> str | None:
        if self.outcome != "failed":
            return None
        return "no_alternative" if self.no_alternative else self.reason


@dataclass
class RegenerationLog:
    requests: dict[str, RegenerationMetrics] = field(default_factory=dict)
    rejections: list[tuple[str, str]] = field(default_factory=list)
    timed_out: list[tuple[int, str]] = field(default_factory=list)


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


def regeneration_request_ids(events: list[dict]) -> set[str]:
    return {
        e["request_id"]
        for e in events
        if e["event"] == Event.REGENERATION_REQUESTED and e.get("request_id", "-") != "-"
    }


def mismatched_regenerations(events: list[dict]) -> list[int]:
    requested: dict[int, str] = {}
    ended: dict[int, set[str]] = {}
    for e in events:
        regeneration_id = e.get("regeneration_request_id")
        if regeneration_id is None:
            continue
        if e["event"] == Event.REGENERATION_REQUESTED:
            requested[regeneration_id] = e.get("request_id")
        elif e["event"] in REGENERATION_END_EVENTS:
            ended.setdefault(regeneration_id, set()).add(e.get("request_id"))
    return sorted(rid for rid, ids in ended.items() if rid in requested and ids != {requested[rid]})


def collect_sessions(events: list[dict]) -> dict[int, SessionMetrics]:
    regeneration_ids = regeneration_request_ids(events)
    sessions: dict[int, SessionMetrics] = {}
    for e in events:
        session_id = e.get("recommendation_session_id")
        if not session_id or e["event"] not in TRACKED_EVENTS:
            continue
        if e.get("request_id") in regeneration_ids:
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


def load_e2e_runs(paths: list[Path]) -> dict[int, dict]:
    runs: dict[int, dict] = {}
    for path in paths:
        for run in json.loads(path.read_text(encoding="utf-8"))["runs"]:
            if "recommendation_session_id" in run:
                runs[run["recommendation_session_id"]] = run
    return runs


def load_e2e_regenerations(paths: list[Path]) -> list[dict]:
    regenerations: list[dict] = []
    for path in paths:
        regenerations += json.loads(path.read_text(encoding="utf-8")).get("regenerations", [])
    return regenerations


def collect_regenerations(events: list[dict]) -> RegenerationLog:
    log = RegenerationLog()
    by_regeneration_id: dict[int, RegenerationMetrics] = {}
    for e in events:
        if e["event"] == Event.REGENERATION_REQUESTED and e.get("request_id", "-") != "-":
            m = RegenerationMetrics(
                regeneration_request_id=e["regeneration_request_id"],
                request_id=e["request_id"],
                session_id=e.get("recommendation_session_id"),
                target_scope_cd=e.get("target_scope_cd"),
                has_target_slot=bool(e.get("has_target_slot")),
            )
            log.requests[m.request_id] = m
            by_regeneration_id[m.regeneration_request_id] = m

    for e in events:
        event = e["event"]
        if event == Event.REGENERATION_REJECTED:
            log.rejections.append((e.get("reason"), e.get("request_id")))
            continue
        if event == Event.REGENERATION_TIMED_OUT:
            log.timed_out.append((e.get("failed_count", 0), e.get("request_id")))
            continue
        if event in REGENERATION_END_EVENTS or event == Event.REGENERATION_NO_ALTERNATIVE:
            m = by_regeneration_id.get(e.get("regeneration_request_id"))
        else:
            m = log.requests.get(e.get("request_id"))
        if m is None:
            continue
        if event in REGENERATION_END_EVENTS:
            m.outcome = REGENERATION_OUTCOMES[event]
            m.reason = e.get("reason")
            m.rounds = e.get("rounds")
            m.generation_ms = e.get("elapsed_ms")
        elif event == Event.REGENERATION_NO_ALTERNATIVE:
            m.no_alternative = True
        elif event == Event.RECOMMEND_TARGET_CAPPED:
            m.target = e["target"]
        elif event == Event.RECOMMEND_REGENERATE:
            m.regenerations += 1
            m.regenerate_count += e["regenerate_count"]
        elif event == Event.HARD_RULE_FAIL:
            m.hard_rule_fail += 1
        elif event == Event.REVIEWER_FAIL:
            m.reviewer_fail += 1
        elif event == Event.LLM_CALL:
            m.llm_calls += 1
            if e.get("call_name") == INTENT_CALL_NAME:
                m.intent_ms = (m.intent_ms or 0) + e.get("latency_ms", 0)
    return log


def select_regenerations(
    log: RegenerationLog, e2e_regenerations: list[dict] | None
) -> RegenerationLog:
    if e2e_regenerations is None:
        return log
    recorded = {r["request_id"]: r for r in e2e_regenerations if r.get("request_id")}
    selected = RegenerationLog(
        requests={rid: m for rid, m in log.requests.items() if rid in recorded},
        rejections=[(reason, rid) for reason, rid in log.rejections if rid in recorded],
        timed_out=[(count, rid) for count, rid in log.timed_out if rid in recorded],
    )
    for rid, m in selected.requests.items():
        record = recorded[rid]
        m.intentional = bool(record.get("intentional"))
        if record.get("final_status") == "completed":
            m.elapsed_s = record.get("elapsed_s")
    return selected


def select_sessions(
    sessions: dict[int, SessionMetrics], e2e_runs: dict[int, dict] | None
) -> tuple[list[SessionMetrics], list[int]]:
    if e2e_runs is None:
        return [sessions[sid] for sid in sorted(sessions)], []
    selected, missing = [], []
    for sid in sorted(e2e_runs):
        if sid not in sessions:
            missing.append(sid)
            continue
        m = sessions[sid]
        m.generation_status_cd = e2e_runs[sid].get("generation_status_cd")
        if m.generation_status_cd == "completed":
            m.elapsed_s = e2e_runs[sid].get("elapsed_s")
        selected.append(m)
    return selected, missing


def incomplete_note(statuses: list[str]) -> str:
    incomplete = [s for s in statuses if s != "completed"]
    return (
        f"미완료 {len(incomplete)}회 (processing {incomplete.count('processing')},"
        f" failed {incomplete.count('failed')}) — 응답 시간 평균에서 제외"
    )


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
        "e2e_statuses": [m.generation_status_cd for m in sessions if m.generation_status_cd],
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


def _regeneration_rates(log: RegenerationLog, excluded: set[str]) -> dict:
    requests = [m for m in log.requests.values() if m.request_id not in excluded]
    reasons = [reason for reason, rid in log.rejections if rid not in excluded]
    unclear = reasons.count("unclear")
    parsed = len(requests) + sum(reason in PARSED_REJECT_REASONS for reason in reasons)
    failed = sum(m.outcome == "failed" for m in requests)
    finished = failed + sum(m.outcome == "completed" for m in requests)
    return {
        "unclear": unclear,
        "parsed": parsed,
        "unclear_rate": _rate(unclear, parsed),
        "failed": failed,
        "finished": finished,
        "failure_rate": _rate(failed, finished),
    }


def summarize_regenerations(log: RegenerationLog, e2e_regenerations: list[dict] | None) -> dict:
    requests = sorted(log.requests.values(), key=lambda m: m.regeneration_request_id)
    over_target = [
        m for m in requests if m.elapsed_s is not None and m.elapsed_s > RESPONSE_TIME_TARGET_S
    ]
    requested = sum(m.requested for m in requests)
    hard = sum(m.hard_rule_fail for m in requests)
    review = sum(m.reviewer_fail for m in requests)
    regenerations = sum(m.regenerations for m in requests)
    elapsed = [m.elapsed_s for m in requests if m.elapsed_s is not None]
    if e2e_regenerations is None:
        excluding_intentional = None
        e2e_only_codes: Counter = Counter()
    else:
        intentional = {r["request_id"] for r in e2e_regenerations if r.get("intentional")}
        excluding_intentional = _regeneration_rates(log, intentional)
        e2e_only_codes = Counter(
            (r.get("post_status"), r["error_code"])
            for r in e2e_regenerations
            if r.get("error_code") in E2E_ONLY_CODES
        )
    return {
        "request_count": len(requests),
        "rejected_by_reason": Counter(reason for reason, _ in log.rejections),
        "all": _regeneration_rates(log, set()),
        "excluding_intentional": excluding_intentional,
        "failure_kinds": Counter(m.failure_kind for m in requests if m.failure_kind),
        "discarded": sum(m.outcome == "discarded" for m in requests),
        "timed_out": sum(count for count, _ in log.timed_out),
        "unfinished": sum(m.outcome is None for m in requests),
        "requested": requested,
        "hard_rule_fail": hard,
        "hard_rule_fail_rate": _rate(hard, requested),
        "reviewer_fail": review,
        "reviewer_fail_rate": _rate(review, requested),
        "regenerations": regenerations,
        "regenerations_per_request": _rate(regenerations, len(requests)),
        "response_time_avg_s": _mean(elapsed),
        "response_time_max_s": max(elapsed) if elapsed else None,
        "response_time_count": len(elapsed),
        "over_target": over_target,
        "e2e_only_codes": e2e_only_codes,
        "has_e2e": e2e_regenerations is not None,
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
    mismatched: Sequence[int] = (),
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
    if mismatched:
        print(
            f"\n경고: 접수와 끝 로그의 request_id가 다른 재추천 요청 {list(mismatched)}."
            " 이 요청의 검증 로그가 첫 추천에 섞였을 수 있음"
        )

    s = summary
    print(f"\n=== 전체 요약 (세션 {s['session_count']}개) ===")
    if not s["e2e_statuses"]:
        print("평균 응답 시간: E2E 실행 기록(--e2e)이 없어 계산하지 않음")
    else:
        if s["response_time_count"]:
            print(
                f"평균 응답 시간: {s['response_time_avg_s']:.1f}초"
                f" (최대 {s['response_time_max_s']:.1f}초,"
                f" {RESPONSE_TIME_TARGET_S:.0f}초 초과 {s['response_time_over_target']}회,"
                f" completed {s['response_time_count']}회 기준)"
            )
        print(f"  {incomplete_note(s['e2e_statuses'])}")
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


def _ratio(numerator: int, denominator: int, rate: float | None) -> str:
    return f"{numerator}/{denominator} = {_pct(rate)}"


def _counts(counter: Counter) -> str:
    return ", ".join(f"{key} {count}" for key, count in sorted(counter.items()))


def print_regeneration_report(log: RegenerationLog, summary: dict) -> None:
    s = summary
    print("\n=== 재추천 ===")
    print(" ".join(pad(text, width) for text, width in REGENERATION_HEADER))
    for m in sorted(log.requests.values(), key=lambda m: m.regeneration_request_id):
        intent_ms = None if m.intent_ms is None else round(m.intent_ms)
        print(
            f"{m.regeneration_request_id:>6} {_num(m.session_id):>6} {m.scope:>6}"
            f" {_num(m.failure_kind or m.outcome):>14} {_num(intent_ms):>8}"
            f" {_num(m.generation_ms):>8} {m.llm_calls:>4} {m.requested:>4}"
            f" {m.hard_rule_fail:>8} {m.reviewer_fail:>8} {m.regenerations:>6}"
            f" {_num(m.elapsed_s):>7} {'예외' if m.intentional else '-':>4}"
        )

    rejected = s["rejected_by_reason"]
    print(
        f"\n요청 수: 접수 {s['request_count']}회,"
        f" 거절 {sum(rejected.values())}회" + (f" ({_counts(rejected)})" if rejected else "")
    )

    every, excluding = s["all"], s["excluding_intentional"]
    print(
        "이해 못 함 비율(전체): " + _ratio(every["unclear"], every["parsed"], every["unclear_rate"])
    )
    if excluding is None:
        print("이해 못 함 비율(의도적 예외 제외): E2E 기록 없음")
    else:
        print(
            "이해 못 함 비율(의도적 예외 제외): "
            + _ratio(excluding["unclear"], excluding["parsed"], excluding["unclear_rate"])
        )
    print(f"  {UNCLEAR_NOTE}")

    kinds = s["failure_kinds"]
    print(
        "재추천 실패율(전체): "
        + _ratio(every["failed"], every["finished"], every["failure_rate"])
        + (f" ({_counts(kinds)})" if kinds else "")
    )
    if excluding is None:
        print("재추천 실패율(의도적 예외 제외): E2E 기록 없음")
    else:
        print(
            "재추천 실패율(의도적 예외 제외): "
            + _ratio(excluding["failed"], excluding["finished"], excluding["failure_rate"])
        )
    print(
        f"  {FAILURE_NOTE}. 버림 {s['discarded']}회·시간 초과 {s['timed_out']}회는 따로 셈"
        + (f", 끝 로그 없음 {s['unfinished']}회" if s["unfinished"] else "")
    )

    print(
        "재추천 1차 실패율: "
        + _ratio(s["hard_rule_fail"], s["requested"], s["hard_rule_fail_rate"])
    )
    print(
        "재추천 2차 실패율: " + _ratio(s["reviewer_fail"], s["requested"], s["reviewer_fail_rate"])
    )
    print(f"  {REGENERATION_DENOMINATOR_NOTE}")
    per_request = s["regenerations_per_request"]
    print(
        f"재생성: 총 {s['regenerations']}회,"
        f" 요청당 {'-' if per_request is None else f'{per_request:.2f}'}회"
    )

    if not s["has_e2e"]:
        print("평균 응답 시간: E2E 실행 기록(--e2e)이 없어 계산하지 않음")
    elif s["response_time_count"]:
        print(
            f"평균 응답 시간: {s['response_time_avg_s']:.1f}초"
            f" (최대 {s['response_time_max_s']:.1f}초,"
            f" {RESPONSE_TIME_TARGET_S:.0f}초 초과 {len(s['over_target'])}회,"
            f" completed {s['response_time_count']}회 기준)"
        )
        for m in s["over_target"]:
            intent_s = "-" if m.intent_ms is None else f"{m.intent_ms / 1000:.1f}초"
            generation_s = "-" if m.generation_ms is None else f"{m.generation_ms / 1000:.1f}초"
            print(
                f"  요청 {m.regeneration_request_id}: 응답 {m.elapsed_s:.1f}초,"
                f" 파싱 {intent_s}, 생성 {generation_s}, 라운드 {_num(m.rounds)}"
            )
    if s["e2e_only_codes"]:
        codes = ", ".join(
            f"{status} {code} {count}"
            for (status, code), count in sorted(s["e2e_only_codes"].items(), key=str)
        )
        print(f"E2E 기록에서만 센 거절: {codes}")
    print("* 응답 시간·의도적 예외·E2E 기록에서만 센 거절은 E2E 실행 기록, 나머지는 서버 로그 기준")


def main() -> int:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawTextHelpFormatter
    )
    parser.add_argument("log", type=Path, help="서버 로그 파일 (JSON 줄)")
    parser.add_argument("--e2e", type=Path, nargs="+", help="recommendation_e2e.py의 JSON 결과")
    args = parser.parse_args()

    events = parse_events(read_log_lines(args.log))
    e2e_runs = load_e2e_runs(args.e2e) if args.e2e else None
    sessions, missing = select_sessions(collect_sessions(events), e2e_runs)
    if not sessions:
        print("집계할 세션이 없습니다. 로그 파일과 --e2e 기록을 확인하세요.", file=sys.stderr)
        return 1
    print_report(
        sessions, summarize(sessions), llm_models(events), missing, mismatched_regenerations(events)
    )

    e2e_regenerations = load_e2e_regenerations(args.e2e) if args.e2e else None
    regeneration_log = select_regenerations(collect_regenerations(events), e2e_regenerations)
    if regeneration_log.requests or regeneration_log.rejections or e2e_regenerations:
        print_regeneration_report(
            regeneration_log, summarize_regenerations(regeneration_log, e2e_regenerations)
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
