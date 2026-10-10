"""E2E 스크립트의 외출 시각 계산과 요약 출력 테스트."""

from datetime import datetime, timedelta

import pytest

from app.services.weather.base_time import KST
from scripts.recommendation_e2e import PreflightError, going_out_window, print_runs


def _at(hour: int, minute: int) -> datetime:
    return datetime(2026, 10, 10, hour, minute, 0, tzinfo=KST)


@pytest.mark.parametrize(
    ("now", "expected_start"),
    [
        (_at(14, 5), _at(14, 30)),
        (_at(14, 20), _at(14, 30)),
        (_at(14, 30), _at(15, 0)),
        (_at(23, 15), _at(23, 30)),
    ],
)
def test_start_is_first_half_hour_after_margin(now, expected_start):
    start, end = going_out_window(now, hours=4)

    assert start == expected_start
    assert end == expected_start + timedelta(hours=4)


def test_end_may_cross_midnight():
    _, end = going_out_window(_at(23, 15), hours=4)

    assert end == datetime(2026, 10, 11, 3, 30, tzinfo=KST)


@pytest.mark.parametrize("now", [_at(23, 45), _at(23, 55)])
def test_start_past_midnight_is_rejected(now):
    with pytest.raises(PreflightError):
        going_out_window(now, hours=4)


def _run(status: str, elapsed_s: float) -> dict:
    return {
        "scenario": "daily",
        "recommendation_session_id": 1,
        "elapsed_s": elapsed_s,
        "generation_status_cd": status,
        "passed": status == "completed",
        "failures": [] if status == "completed" else ["timeout"],
    }


def test_summary_excludes_incomplete_runs_from_response_time(capsys):
    print_runs([_run("completed", 14.2), _run("processing", 120.3)])

    out = capsys.readouterr().out
    assert "응답 시간 평균 14.2초, 최대 14.2초, 20초 초과 0회 (completed 1회 기준)" in out
    assert "미완료 1회 (processing 1, failed 0) — 응답 시간 평균에서 제외" in out
