"""로그 집계 스크립트의 계산 테스트."""

import json
import unicodedata

import pytest

from scripts.aggregate_metrics import (
    collect_regenerations,
    collect_sessions,
    incomplete_note,
    load_e2e_regenerations,
    load_e2e_runs,
    main,
    mismatched_regenerations,
    pad,
    parse_events,
    print_regeneration_report,
    print_report,
    read_log_lines,
    select_regenerations,
    select_sessions,
    summarize,
    summarize_regenerations,
)


def _line(**fields) -> str:
    return json.dumps(fields, ensure_ascii=False)


def _candidates(session_id: int, owned: int, filtered: int, candidates: int) -> str:
    return _line(
        event="recommend.candidates",
        recommendation_session_id=session_id,
        owned_count=owned,
        filtered_owned_count=filtered,
        candidate_count=candidates,
    )


LOG_LINES = [
    "INFO:     Uvicorn running on http://127.0.0.1:8000",
    _line(event="http.request", elapsed_ms=12.3),
    _candidates(1, 30, 18, 20),
    _line(event="validation.hard_rule.fail", recommendation_session_id=1, round=1),
    _line(event="validation.reviewer.fail", recommendation_session_id=1, round=1),
    _line(event="recommend.regenerate", recommendation_session_id=1, round=1, regenerate_count=2),
    _line(event="validation.reviewer.fail", recommendation_session_id=1, round=2),
    _candidates(2, 5, 4, 9),
    _line(event="recommend.target_capped", recommendation_session_id=2, requested=4, target=3),
    _line(event="recommend.fallback", recommendation_session_id=2, requested=1, built=1),
    _candidates(0, 30, 10, 10),
    _line(event="session.canceled", recommendation_session_id=3, deleted_outfit_count=4),
    _line(event="preference.settled", recommendation_session_id=3),
    _line(event="llm.call", call_name="outfit_generation", model="m", prompt_version="v1.0"),
]


def test_requested_is_target_plus_regenerate_count():
    sessions = collect_sessions(parse_events(LOG_LINES))

    assert sessions[1].target == 4
    assert sessions[1].requested == 4 + 2
    assert sessions[1].regenerations == 1
    assert sessions[2].target == 3
    assert sessions[2].requested == 3


def _regeneration(session_id: int, regeneration_id: int, request_id: str) -> list[str]:
    return [
        _line(
            event="regeneration.requested",
            request_id=request_id,
            recommendation_session_id=session_id,
            regeneration_request_id=regeneration_id,
            target_scope_cd="all",
        ),
        _line(
            event="validation.hard_rule.fail",
            request_id=request_id,
            recommendation_session_id=session_id,
            round=1,
        ),
        _line(
            event="validation.reviewer.fail",
            request_id=request_id,
            recommendation_session_id=session_id,
            round=1,
        ),
        _line(
            event="recommend.regenerate",
            request_id=request_id,
            recommendation_session_id=session_id,
            round=1,
            regenerate_count=1,
        ),
        _line(
            event="recommend.target_capped",
            request_id=request_id,
            recommendation_session_id=session_id,
            requested=4,
            target=2,
        ),
        _line(
            event="recommend.fallback",
            request_id=request_id,
            recommendation_session_id=session_id,
            requested=1,
            built=0,
        ),
        _line(
            event="regeneration.completed",
            request_id=request_id,
            recommendation_session_id=session_id,
            regeneration_request_id=regeneration_id,
        ),
    ]


def test_regeneration_logs_do_not_change_first_recommendation_metrics():
    mixed = LOG_LINES + _regeneration(1, 10, "req-a") + _regeneration(2, 11, "req-b")

    sessions = collect_sessions(parse_events(mixed))

    assert sessions == collect_sessions(parse_events(LOG_LINES))


def test_regeneration_ends_logged_with_other_request_id_are_reported(capsys):
    lines = _regeneration(1, 10, "req-a") + _regeneration(2, 11, "req-b")
    lines[-1] = _line(
        event="regeneration.completed",
        request_id="worker-1",
        recommendation_session_id=2,
        regeneration_request_id=11,
    )

    mismatched = mismatched_regenerations(parse_events(lines))
    print_report([], summarize([]), [], [], mismatched)

    assert mismatched == [11]
    assert "접수와 끝 로그의 request_id가 다른 재추천 요청 [11]" in capsys.readouterr().out


def test_no_warning_when_regeneration_logs_share_request_id(capsys):
    events = parse_events(_regeneration(1, 10, "req-a"))

    mismatched = mismatched_regenerations(events)
    print_report([], summarize([]), [], [], mismatched)

    assert mismatched == []
    assert "request_id가 다른" not in capsys.readouterr().out


def _requested(request_id: str, regeneration_id: int, scope: str, slot: bool = False) -> str:
    return _line(
        event="regeneration.requested",
        request_id=request_id,
        recommendation_session_id=5,
        regeneration_request_id=regeneration_id,
        target_scope_cd=scope,
        has_target_slot=slot,
    )


def _in_request(request_id: str, event: str, **fields) -> str:
    return _line(event=event, request_id=request_id, recommendation_session_id=5, **fields)


def _ended(request_id: str, regeneration_id: int, event: str, **fields) -> str:
    return _in_request(request_id, event, regeneration_request_id=regeneration_id, **fields)


def _rejected(request_id: str, reason: str) -> str:
    return _in_request(request_id, "regeneration.rejected", reason=reason)


REGENERATION_LINES = [
    _requested("r-all", 20, "all"),
    _in_request("r-all", "llm.call", call_name="regeneration_intent", latency_ms=1500.0, model="h"),
    _in_request("r-all", "recommend.target_capped", requested=4, target=3),
    _in_request("r-all", "llm.call", call_name="outfit_generation", latency_ms=8000.0, model="s"),
    _in_request("r-all", "validation.hard_rule.fail", round=1),
    _in_request("r-all", "validation.reviewer.fail", round=1),
    _in_request("r-all", "recommend.regenerate", round=1, regenerate_count=1),
    _ended("r-all", 20, "regeneration.completed", rounds=2, elapsed_ms=9000),
    _requested("r-single", 21, "single"),
    _in_request("r-single", "regeneration.timed_out", failed_count=2),
    _ended("r-single", 21, "regeneration.completed", rounds=1, elapsed_ms=4000),
    _requested("r-noalt", 22, "single", slot=True),
    _ended("r-noalt", 22, "regeneration.no_alternative", slots=["accessories"]),
    _ended("r-noalt", 22, "regeneration.failed", reason="empty", elapsed_ms=300),
    _requested("r-error", 23, "single"),
    _ended("r-error", 23, "regeneration.failed", reason="error", error_type="RuntimeError"),
    _requested("r-discard", 24, "single", slot=True),
    _ended("r-discard", 24, "regeneration.discarded", reason="session_ended"),
    _rejected("x-unclear", "unclear"),
    _rejected("x-harmful-intent", "harmful_intent"),
    _rejected("x-refused", "intent_refused"),
    _rejected("x-intent-failed", "intent_failed"),
    _rejected("x-in-progress", "in_progress"),
    _rejected("x-empty", "empty"),
    _rejected("x-too-long", "too_long"),
    _rejected("x-harmful-input", "harmful_input"),
]


def _regeneration_summary(e2e: list[dict] | None = None) -> dict:
    log = select_regenerations(collect_regenerations(parse_events(REGENERATION_LINES)), e2e)
    return summarize_regenerations(log, e2e)


def test_unclear_rate_counts_only_rejections_after_parsing():
    rates = _regeneration_summary()["all"]

    assert (rates["unclear"], rates["parsed"]) == (1, 5 + 4)
    assert rates["unclear_rate"] == pytest.approx(1 / 9)


def test_failure_rate_counts_discarded_and_timed_out_separately():
    summary = _regeneration_summary()

    assert (summary["all"]["failed"], summary["all"]["finished"]) == (2, 4)
    assert summary["failure_kinds"] == {"no_alternative": 1, "error": 1}
    assert summary["discarded"] == 1
    assert summary["timed_out"] == 2


def test_requested_outfits_follow_scope_and_skip_no_alternative():
    log = collect_regenerations(parse_events(REGENERATION_LINES))
    by_id = {m.regeneration_request_id: m for m in log.requests.values()}

    assert {i: m.scope for i, m in by_id.items()} == {
        20: "all",
        21: "single",
        22: "parts",
        23: "single",
        24: "parts",
    }
    assert {i: m.requested for i, m in by_id.items()} == {20: 3 + 1, 21: 1, 22: 0, 23: 1, 24: 1}
    assert _regeneration_summary()["requested"] == 7


def test_validation_failures_and_llm_calls_belong_to_their_request():
    log = collect_regenerations(parse_events(REGENERATION_LINES))
    first = log.requests["r-all"]
    summary = _regeneration_summary()

    assert (first.hard_rule_fail, first.reviewer_fail, first.regenerations) == (1, 1, 1)
    assert (first.llm_calls, first.intent_ms, first.rounds) == (2, 1500.0, 2)
    assert log.requests["r-single"].hard_rule_fail == 0
    assert summary["hard_rule_fail_rate"] == pytest.approx(1 / 7)
    assert summary["reviewer_fail_rate"] == pytest.approx(1 / 7)


E2E_REGENERATIONS = [
    {"request_id": "r-all", "final_status": "completed", "elapsed_s": 24.0},
    {"request_id": "r-single", "final_status": "completed", "elapsed_s": 11.0},
    {"request_id": "r-noalt", "final_status": "failed", "elapsed_s": 3.0, "intentional": True},
    {"request_id": "r-error", "final_status": "failed", "elapsed_s": 30.0},
    {"request_id": "r-discard", "final_status": None, "intentional": True},
    {"request_id": "x-unclear", "post_status": 422, "intentional": True},
    {"request_id": "x-in-progress", "post_status": 409, "intentional": True},
    {"request_id": "x-not-ready", "post_status": 409, "error_code": "SESSION_NOT_READY"},
    {
        "request_id": "x-not-latest",
        "post_status": 422,
        "error_code": "REGENERATION_TARGET_NOT_LATEST",
    },
]


def test_intentional_requests_are_left_out_of_second_line(capsys):
    e2e = E2E_REGENERATIONS
    log = select_regenerations(collect_regenerations(parse_events(REGENERATION_LINES)), e2e)
    summary = summarize_regenerations(log, e2e)
    print_regeneration_report(log, summary)

    excluding = summary["excluding_intentional"]
    out = capsys.readouterr().out
    assert (excluding["unclear"], excluding["parsed"]) == (0, 3)
    assert (excluding["failed"], excluding["finished"]) == (1, 3)
    assert "이해 못 함 비율(전체): 1/6 = 16.7%" in out
    assert "이해 못 함 비율(의도적 예외 제외): 0/3 = 0.0%" in out
    assert "재추천 실패율(전체): 2/4 = 50.0%" in out
    assert "재추천 실패율(의도적 예외 제외): 1/3 = 33.3%" in out


def test_without_e2e_record_second_line_says_so(capsys):
    log = collect_regenerations(parse_events(REGENERATION_LINES))
    print_regeneration_report(log, summarize_regenerations(log, None))

    out = capsys.readouterr().out
    assert "이해 못 함 비율(의도적 예외 제외): E2E 기록 없음" in out
    assert "재추천 실패율(의도적 예외 제외): E2E 기록 없음" in out
    assert "평균 응답 시간: E2E 실행 기록(--e2e)이 없어 계산하지 않음" in out


def test_e2e_record_selects_requests_and_supplies_completed_response_time(capsys):
    e2e = [r for r in E2E_REGENERATIONS if r["request_id"] != "r-discard"]
    log = select_regenerations(collect_regenerations(parse_events(REGENERATION_LINES)), e2e)
    summary = summarize_regenerations(log, e2e)
    print_regeneration_report(log, summary)

    out = capsys.readouterr().out
    assert set(log.requests) == {"r-all", "r-single", "r-noalt", "r-error"}
    assert summary["response_time_avg_s"] == pytest.approx((24.0 + 11.0) / 2)
    assert [m.request_id for m in summary["over_target"]] == ["r-all"]
    assert "요청 20: 응답 24.0초, 파싱 1.5초, 생성 9.0초, 라운드 2" in out


def _display_width(text: str) -> int:
    return sum(2 if unicodedata.east_asian_width(c) in "WF" else 1 for c in text)


def test_regeneration_table_rows_line_up_with_header(capsys):
    log = select_regenerations(
        collect_regenerations(parse_events(REGENERATION_LINES)), E2E_REGENERATIONS
    )
    print_regeneration_report(log, summarize_regenerations(log, E2E_REGENERATIONS))

    lines = capsys.readouterr().out.splitlines()
    start = lines.index("=== 재추천 ===") + 1
    table = lines[start : lines.index("", start)]
    assert any(line.endswith("예외") for line in table[1:])
    assert {_display_width(line) for line in table} == {_display_width(table[0])}


def test_e2e_only_rejections_are_counted_from_record(capsys):
    log = select_regenerations(
        collect_regenerations(parse_events(REGENERATION_LINES)), E2E_REGENERATIONS
    )
    summary = summarize_regenerations(log, E2E_REGENERATIONS)
    print_regeneration_report(log, summary)

    assert summary["e2e_only_codes"] == {
        (409, "SESSION_NOT_READY"): 1,
        (422, "REGENERATION_TARGET_NOT_LATEST"): 1,
    }
    assert "409 SESSION_NOT_READY 1" in capsys.readouterr().out


def test_old_e2e_record_has_no_regenerations(tmp_path):
    path = tmp_path / "e2e.json"
    path.write_text(json.dumps({"meta": {}, "runs": []}), encoding="utf-8")

    assert load_e2e_regenerations([path]) == []


@pytest.mark.parametrize(("extra_lines", "expected"), [([], False), (REGENERATION_LINES, True)])
def test_regeneration_section_appears_only_with_regeneration_logs(
    tmp_path, monkeypatch, capsys, extra_lines, expected
):
    log = tmp_path / "server.log"
    log.write_text("\n".join(LOG_LINES + extra_lines), encoding="utf-8")
    monkeypatch.setattr("sys.argv", ["aggregate_metrics.py", str(log)])

    assert main() == 0
    assert ("=== 재추천 ===" in capsys.readouterr().out) is expected


def test_scenario_script_session_zero_is_excluded():
    sessions = collect_sessions(parse_events(LOG_LINES))

    assert 0 not in sessions


def test_session_with_only_end_events_is_excluded():
    sessions = collect_sessions(parse_events(LOG_LINES))

    assert set(sessions) == {1, 2}


@pytest.mark.parametrize(
    ("text", "width", "align", "expected"),
    [
        ("세션", 6, ">", "  세션"),
        ("id", 6, ">", "    id"),
        ("응답(s)", 7, ">", "응답(s)"),
        ("부족", 5, "<", "부족 "),
    ],
)
def test_pad_counts_hangul_as_two_columns(text, width, align, expected):
    assert pad(text, width, align) == expected


def test_failure_rates_share_requested_denominator():
    sessions, _ = select_sessions(collect_sessions(parse_events(LOG_LINES)), None)
    summary = summarize(sessions)

    assert summary["requested"] == 9
    assert summary["hard_rule_fail_rate"] == pytest.approx(1 / 9)
    assert summary["reviewer_fail_rate"] == pytest.approx(2 / 9)
    assert summary["fallback_built"] == 1


def test_reduction_rate_is_averaged_per_session():
    sessions, _ = select_sessions(collect_sessions(parse_events(LOG_LINES)), None)
    summary = summarize(sessions)

    assert summary["reduction_rate_avg"] == pytest.approx(((1 - 18 / 30) + (1 - 4 / 5)) / 2)
    assert summary["candidate_count_avg"] == pytest.approx((20 + 9) / 2)


def _e2e(tmp_path, runs: list[dict]):
    path = tmp_path / "e2e.json"
    path.write_text(json.dumps({"meta": {}, "runs": runs}), encoding="utf-8")
    return load_e2e_runs([path])


def test_e2e_record_selects_sessions_and_supplies_response_time(tmp_path):
    e2e_runs = _e2e(
        tmp_path,
        [
            {
                "recommendation_session_id": 2,
                "elapsed_s": 25.0,
                "generation_status_cd": "completed",
            },
            {
                "recommendation_session_id": 99,
                "elapsed_s": 10.0,
                "generation_status_cd": "completed",
            },
            {"scenario": "daily", "error": "POST 422"},
        ],
    )

    sessions, missing = select_sessions(collect_sessions(parse_events(LOG_LINES)), e2e_runs)
    summary = summarize(sessions)

    assert [m.session_id for m in sessions] == [2]
    assert missing == [99]
    assert summary["response_time_avg_s"] == 25.0
    assert summary["response_time_over_target"] == 1


def test_incomplete_run_is_excluded_from_response_time_and_reported(tmp_path, capsys):
    e2e_runs = _e2e(
        tmp_path,
        [
            {
                "recommendation_session_id": 1,
                "elapsed_s": 120.4,
                "generation_status_cd": "processing",
            },
            {
                "recommendation_session_id": 2,
                "elapsed_s": 14.0,
                "generation_status_cd": "completed",
            },
        ],
    )

    sessions, _ = select_sessions(collect_sessions(parse_events(LOG_LINES)), e2e_runs)
    summary = summarize(sessions)
    print_report(sessions, summary, [], [])

    assert [m.session_id for m in sessions] == [1, 2]
    assert summary["requested"] == 9
    assert summary["response_time_avg_s"] == 14.0
    assert summary["response_time_over_target"] == 0
    assert (
        "미완료 1회 (processing 1, failed 0) — 응답 시간 평균에서 제외" in capsys.readouterr().out
    )


def test_incomplete_note_counts_each_status():
    note = incomplete_note(["completed", "failed", "processing", "failed"])

    assert note == "미완료 3회 (processing 1, failed 2) — 응답 시간 평균에서 제외"


def test_without_e2e_record_response_time_is_not_computed():
    sessions, _ = select_sessions(collect_sessions(parse_events(LOG_LINES)), None)

    assert summarize(sessions)["response_time_avg_s"] is None


@pytest.mark.parametrize("encoding", ["utf-16", "utf-8", "utf-8-sig"])
def test_reads_log_written_by_tee_object_or_python(tmp_path, encoding):
    log = tmp_path / "server.log"
    log.write_text("\n".join(LOG_LINES), encoding=encoding)

    events = parse_events(read_log_lines(log))

    assert len(events) == len(LOG_LINES) - 1
