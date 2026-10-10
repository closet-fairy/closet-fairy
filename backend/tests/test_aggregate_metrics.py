"""로그 집계 스크립트의 계산 테스트."""

import json

import pytest

from scripts.aggregate_metrics import (
    collect_sessions,
    load_e2e_elapsed,
    pad,
    parse_events,
    read_log_lines,
    select_sessions,
    summarize,
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


def test_e2e_record_selects_sessions_and_supplies_response_time(tmp_path):
    e2e = tmp_path / "e2e.json"
    e2e.write_text(
        json.dumps(
            {
                "meta": {},
                "runs": [
                    {"recommendation_session_id": 2, "elapsed_s": 25.0},
                    {"recommendation_session_id": 99, "elapsed_s": 10.0},
                    {"scenario": "daily", "error": "POST 422"},
                ],
            }
        ),
        encoding="utf-8",
    )

    sessions, missing = select_sessions(
        collect_sessions(parse_events(LOG_LINES)), load_e2e_elapsed([e2e])
    )
    summary = summarize(sessions)

    assert [m.session_id for m in sessions] == [2]
    assert missing == [99]
    assert summary["response_time_avg_s"] == 25.0
    assert summary["response_time_over_target"] == 1


def test_without_e2e_record_response_time_is_not_computed():
    sessions, _ = select_sessions(collect_sessions(parse_events(LOG_LINES)), None)

    assert summarize(sessions)["response_time_avg_s"] is None


@pytest.mark.parametrize("encoding", ["utf-16", "utf-8", "utf-8-sig"])
def test_reads_log_written_by_tee_object_or_python(tmp_path, encoding):
    log = tmp_path / "server.log"
    log.write_text("\n".join(LOG_LINES), encoding=encoding)

    events = parse_events(read_log_lines(log))

    assert len(events) == len(LOG_LINES) - 1
