"""E2E 스크립트의 외출 시각 계산 테스트."""

from datetime import datetime, timedelta

import pytest

from app.services.weather.base_time import KST
from scripts.recommendation_e2e import PreflightError, going_out_window


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
