"""REC-08 룰 전처리(후보 필터링 + 아우터 판정) 단위 테스트."""

from datetime import datetime

from app.repositories.clothing import ClothingCandidate
from app.services.recommend_context import RecommendContext
from app.services.rule_filter import filter_clothing
from app.services.weather.weather_service import HourlyWeather, WeatherResult

NOW = datetime(2026, 7, 15, 12, 0)


def _clothing(
    clothing_id: int,
    thickness_cd: str | None = "medium",
    is_waterproof: bool | None = False,
    seasons: list[str] | None = None,
) -> ClothingCandidate:
    return ClothingCandidate(
        clothing_id=clothing_id,
        category_cd="outer",
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
) -> RecommendContext:
    return RecommendContext(
        recommendation_session_id=1,
        member_id=1,
        going_out_start_at=NOW,
        going_out_end_at=NOW,
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
    padding = _clothing(1, thickness_cd="thick", seasons=["summer"])
    context = _context([padding], _weather(min_feels_like_temperature=28.0))

    result = filter_clothing(context)

    assert result.candidates == []


def test_outer_required_at_16_degrees():
    context = _context([], _weather(min_feels_like_temperature=16.0), tpo_cd="daily")

    result = filter_clothing(context)

    assert result.outer_requirement == "required"


def test_outer_required_for_wedding_tpo_regardless_of_temperature():
    context = _context(
        [], _weather(min_feels_like_temperature=26.0), tpo_cd="formal", tpo_input_type_cd="preset"
    )

    result = filter_clothing(context)

    assert result.outer_requirement == "required"


def test_custom_tpo_skips_formal_rule():
    context = _context(
        [], _weather(min_feels_like_temperature=26.0), tpo_cd="custom", tpo_input_type_cd="custom"
    )

    result = filter_clothing(context)

    assert result.outer_requirement == "excluded"


def test_rain_forecast_prioritizes_waterproof_items():
    non_waterproof = _clothing(1, is_waterproof=False, seasons=["summer"])
    waterproof = _clothing(2, is_waterproof=True, seasons=["summer"])
    rainy_hour = HourlyWeather(
        at=NOW,
        temperature=20.0,
        feels_like_temperature=20.0,
        precipitation=5.0,
        wind_speed=1.0,
        weather_condition_cd="rain",
    )
    context = _context(
        [non_waterproof, waterproof],
        _weather(min_feels_like_temperature=20.0, hourly=[rainy_hour]),
    )

    result = filter_clothing(context)

    assert [c.clothing_id for c in result.candidates] == [2, 1]
    assert result.rain_expected is True
