"""ASOS 추세 기반 계절 판정.

최근 daily_weather 평균기온으로 9일 이동평균 두 개(오늘 기준 / 직전일 기준)를
구해서, 임계치와 추세로 계절을 판정한다. 데이터가 부족하면 월 기준으로 대체한다.
"""

from decimal import Decimal


def month_based_season(month: int) -> str:
    """데이터가 부족할 때 쓰는 월 기준 대체."""
    if month in (3, 4, 5):
        return "spring"
    if month in (6, 7, 8):
        return "summer"
    if month in (9, 10, 11):
        return "fall"
    return "winter"


def determine_season(
    recent_avg_temps: list[Decimal],
    reference_month: int,
    summer_threshold: Decimal,
    winter_threshold: Decimal,
    window_days: int,
) -> str:
    """recent_avg_temps: 오래된 날짜 -> 최근 날짜 순으로 정렬된 일평균기온.

    최소 window_days + 1개가 있어야 추세(오늘/직전일 이동평균)를 계산할 수 있다.
    """
    if len(recent_avg_temps) < window_days + 1:
        return month_based_season(reference_month)

    today_window = recent_avg_temps[-window_days:]
    previous_window = recent_avg_temps[-(window_days + 1) : -1]
    ma_today = sum(today_window) / len(today_window)
    ma_previous = sum(previous_window) / len(previous_window)

    if ma_today >= summer_threshold:
        return "summer"
    if ma_today < winter_threshold:
        return "winter"
    if ma_today > ma_previous:
        return "spring"
    if ma_today < ma_previous:
        return "fall"
    return month_based_season(reference_month)
