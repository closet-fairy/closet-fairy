"""REC-08 룰 전처리(후보 필터링 + 아우터 판정) 단위 테스트."""

from datetime import datetime

from app.repositories.clothing import ClothingCandidate
from app.services.recommend_context import RecommendContext
from app.services.rule_filter import filter_clothing
from app.services.weather.weather_service import HourlyWeather, WeatherResult

NOW = datetime(2026, 7, 15, 12, 0)


def _clothing(
    clothing_id: int,
    category_cd: str = "outer",
    thickness_cd: str | None = "medium",
    is_waterproof: bool | None = False,
    seasons: list[str] | None = None,
) -> ClothingCandidate:
    return ClothingCandidate(
        clothing_id=clothing_id,
        category_cd=category_cd,
        accessory_type_cd=None,
        item_name=f"item-{clothing_id}",
        color_cd="black",
        thickness_cd=thickness_cd,
        is_waterproof=is_waterproof,
        origin_image_url="http://example.com/img.png",
        cutout_image_url=None,
        styles=[],
        seasons=seasons if seasons is not None else [],
    )


def _weather(
    min_feels_like_temperature: float,
    weather_condition_cd: str = "clear",
    hourly: list[HourlyWeather] | None = None,
) -> WeatherResult:
    return WeatherResult(
        temperature=min_feels_like_temperature,
        feels_like_temperature=min_feels_like_temperature,
        precipitation=0.0,
        wind_speed=0.0,
        weather_condition_cd=weather_condition_cd,
        min_feels_like_temperature=min_feels_like_temperature,
        hourly=hourly or [],
    )


def _context(
    clothing: list[ClothingCandidate],
    weather: WeatherResult,
    season_cd: str = "summer",
    tpo_cd: str = "daily",
    tpo_input_type_cd: str = "preset",
    going_out_start_at: datetime = NOW,
    going_out_end_at: datetime = NOW,
) -> RecommendContext:
    return RecommendContext(
        recommendation_session_id=1,
        member_id=1,
        going_out_start_at=going_out_start_at,
        going_out_end_at=going_out_end_at,
        season_cd=season_cd,
        tpo_cd=tpo_cd,
        tpo_text=None,
        tpo_input_type_cd=tpo_input_type_cd,
        weather=weather,
        birth_year=None,
        temperature_sensitivity_cd=None,
        gender_cd="unisex",
        preferred_styles=[],
        clothing=clothing,
    )


def test_summer_padding_is_removed():
    padding = _clothing(1, category_cd="outer", thickness_cd="thick", seasons=["summer"])
    context = _context([padding], _weather(min_feels_like_temperature=28.0))

    result = filter_clothing(context)

    assert result.candidates == []


def test_season_mismatch_is_removed():
    winter_only = _clothing(1, category_cd="top", thickness_cd="medium", seasons=["winter"])
    context = _context([winter_only], _weather(min_feels_like_temperature=25.0), season_cd="summer")

    result = filter_clothing(context)

    assert result.candidates == []


def test_untagged_season_passes_through():
    untagged = _clothing(1, category_cd="top", thickness_cd="medium", seasons=[])
    context = _context([untagged], _weather(min_feels_like_temperature=25.0), season_cd="summer")

    result = filter_clothing(context)

    assert [c.clothing_id for c in result.candidates] == [1]


def test_thin_top_survives_winter_for_layering():
    thin_top = _clothing(1, category_cd="top", thickness_cd="thin", seasons=["winter"])
    context = _context([thin_top], _weather(min_feels_like_temperature=-5.0), season_cd="winter")

    result = filter_clothing(context)

    assert [c.clothing_id for c in result.candidates] == [1]


def test_thin_outer_is_removed_in_winter():
    thin_outer = _clothing(1, category_cd="outer", thickness_cd="thin", seasons=["winter"])
    context = _context([thin_outer], _weather(min_feels_like_temperature=-5.0), season_cd="winter")

    result = filter_clothing(context)

    assert result.candidates == []


def test_outer_required_at_16_degrees():
    context = _context([], _weather(min_feels_like_temperature=16.0), tpo_cd="daily")

    result = filter_clothing(context)

    assert result.outer_requirement == "required"


def test_outer_optional_between_thresholds():
    context = _context([], _weather(min_feels_like_temperature=18.0), tpo_cd="daily")

    result = filter_clothing(context)

    assert result.outer_requirement == "optional"


def test_outer_required_for_wedding_tpo_regardless_of_temperature():
    context = _context(
        [], _weather(min_feels_like_temperature=26.0), tpo_cd="formal", tpo_input_type_cd="preset"
    )

    result = filter_clothing(context)

    assert result.outer_requirement == "required"


def test_outer_required_for_midwinter_tpo_regardless_of_temperature():
    context = _context(
        [],
        _weather(min_feels_like_temperature=18.0),
        tpo_cd="midwinter",
        tpo_input_type_cd="preset",
    )

    result = filter_clothing(context)

    assert result.outer_requirement == "required"


def test_custom_tpo_skips_formal_rule():
    context = _context(
        [], _weather(min_feels_like_temperature=26.0), tpo_cd="custom", tpo_input_type_cd="custom"
    )

    result = filter_clothing(context)

    assert result.outer_requirement == "excluded"


def test_rain_in_going_out_window_prioritizes_waterproof_items():
    non_waterproof = _clothing(1, is_waterproof=False, seasons=["summer"])
    waterproof = _clothing(2, is_waterproof=True, seasons=["summer"])
    going_out_start = datetime(2026, 7, 15, 12, 0)
    going_out_end = datetime(2026, 7, 15, 14, 0)
    rainy_hour = HourlyWeather(
        at=datetime(2026, 7, 15, 13, 0),
        temperature=20.0,
        feels_like_temperature=20.0,
        precipitation=5.0,
        wind_speed=1.0,
        weather_condition_cd="rain",
    )
    context = _context(
        [non_waterproof, waterproof],
        _weather(min_feels_like_temperature=20.0, hourly=[rainy_hour]),
        going_out_start_at=going_out_start,
        going_out_end_at=going_out_end,
    )

    result = filter_clothing(context)

    assert [c.clothing_id for c in result.candidates] == [2, 1]
    assert result.precipitation_expected is True


def test_rainy_tpo_triggers_precipitation_even_with_clear_forecast():
    context = _context([], _weather(min_feels_like_temperature=20.0), tpo_cd="rainy")

    result = filter_clothing(context)

    assert result.precipitation_expected is True


def test_rain_outside_going_out_window_is_ignored():
    non_waterproof = _clothing(1, is_waterproof=False, seasons=["summer"])
    going_out_start = datetime(2026, 7, 15, 12, 0)
    going_out_end = datetime(2026, 7, 15, 14, 0)
    rainy_tomorrow = HourlyWeather(
        at=datetime(2026, 7, 16, 3, 0),
        temperature=18.0,
        feels_like_temperature=18.0,
        precipitation=5.0,
        wind_speed=1.0,
        weather_condition_cd="rain",
    )
    context = _context(
        [non_waterproof],
        _weather(min_feels_like_temperature=20.0, hourly=[rainy_tomorrow]),
        going_out_start_at=going_out_start,
        going_out_end_at=going_out_end,
    )

    result = filter_clothing(context)

    assert result.precipitation_expected is False
