from decimal import Decimal

from app.services.weather.season import determine_season

SUMMER_THRESHOLD = Decimal("20.0")
WINTER_THRESHOLD = Decimal("5.0")
WINDOW_DAYS = 9


def temps(*values: float) -> list[Decimal]:
    return [Decimal(str(v)) for v in values]


def test_summer_when_moving_average_is_high():
    recent = temps(*([22.0] * 10))
    season = determine_season(recent, 7, SUMMER_THRESHOLD, WINTER_THRESHOLD, WINDOW_DAYS)
    assert season == "summer"


def test_winter_when_moving_average_is_low():
    recent = temps(*([3.0] * 10))
    season = determine_season(recent, 1, SUMMER_THRESHOLD, WINTER_THRESHOLD, WINDOW_DAYS)
    assert season == "winter"


def test_spring_when_trend_is_rising():
    # 직전 9일은 10도 안팎, 최근 9일은 그보다 살짝 높다 -> 상승 추세
    recent = temps(10, 10, 10, 10, 10, 10, 10, 10, 10, 15)
    season = determine_season(recent, 4, SUMMER_THRESHOLD, WINTER_THRESHOLD, WINDOW_DAYS)
    assert season == "spring"


def test_fall_when_trend_is_falling():
    # 직전 9일이 최근 9일보다 높다 -> 하강 추세
    recent = temps(15, 10, 10, 10, 10, 10, 10, 10, 10, 10)
    season = determine_season(recent, 10, SUMMER_THRESHOLD, WINTER_THRESHOLD, WINDOW_DAYS)
    assert season == "fall"


def test_falls_back_to_month_when_data_is_insufficient():
    season = determine_season([], 7, SUMMER_THRESHOLD, WINTER_THRESHOLD, WINDOW_DAYS)
    assert season == "summer"
