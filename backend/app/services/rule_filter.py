"""룰 기반 후보 필터링 + 아우터 판정 (REC-08).

순수 함수. DB·외부 API 호출 없음 — collect_context()가 모아 온 RecommendContext를
받아 계산만 한다. 28도에 패딩을 후보에서 빼면 LLM이 애초에 고를 수 없으므로,
검증(2차 리뷰어)보다 먼저 확실하고 비용 0인 규칙으로 걸러낸다.
"""

from dataclasses import dataclass
from typing import Literal

from app.core.config import get_settings
from app.repositories.clothing import ClothingCandidate
from app.services.recommend_context import RecommendContext

OuterRequirement = Literal["required", "optional", "excluded"]

# TPO 프리셋 중 "격식 상황"(결혼식 하객·면접 등)으로 취급하는 코드.
# 자유 입력(custom)은 1차 룰을 건너뛰고 2차 AI 리뷰어에 위임한다 (FR-REC-03-1).
FORMAL_TPO_CODES = {"formal"}

RAIN_CONDITION_CODES = {"rain", "sleet", "snow"}


@dataclass
class FilterResult:
    candidates: list[ClothingCandidate]
    outer_requirement: OuterRequirement
    rain_expected: bool


def _season_matches(candidate: ClothingCandidate, season_cd: str) -> bool:
    """계절 태깅이 없는 옷은 통과시킨다 (미결 항목 권장안: 통과, 판단은 LLM에)."""
    if not candidate.seasons:
        return True
    return season_cd in candidate.seasons


def _thickness_matches(candidate: ClothingCandidate, min_feels_like: float) -> bool:
    settings = get_settings()
    if candidate.thickness_cd == "thick" and min_feels_like > float(
        settings.THICK_CLOTHING_MAX_FEELS_LIKE_TEMPERATURE
    ):
        return False
    if candidate.thickness_cd == "thin" and min_feels_like < float(
        settings.THIN_CLOTHING_MIN_FEELS_LIKE_TEMPERATURE
    ):
        return False
    return True


def _is_rain_expected(context: RecommendContext) -> bool:
    weather = context.weather
    if weather.weather_condition_cd in RAIN_CONDITION_CODES:
        return True
    return any(h.weather_condition_cd in RAIN_CONDITION_CODES for h in weather.hourly)


def _determine_outer_requirement(context: RecommendContext) -> OuterRequirement:
    settings = get_settings()
    min_feels_like = context.weather.min_feels_like_temperature
    is_formal_tpo = context.tpo_input_type_cd == "preset" and context.tpo_cd in FORMAL_TPO_CODES

    if is_formal_tpo:
        return "required"
    if min_feels_like <= float(settings.OUTER_REQUIRED_FEELS_LIKE_TEMPERATURE):
        return "required"
    if min_feels_like >= float(settings.OUTER_EXCLUDED_FEELS_LIKE_TEMPERATURE):
        return "excluded"
    return "optional"


def filter_clothing(context: RecommendContext) -> FilterResult:
    """계절 역행 제거 + 두께/체감온도 필터링 + 아우터 판정을 한 번에 수행한다."""
    rain_expected = _is_rain_expected(context)
    min_feels_like = context.weather.min_feels_like_temperature

    candidates = [
        c
        for c in context.clothing
        if _season_matches(c, context.season_cd) and _thickness_matches(c, min_feels_like)
    ]

    if rain_expected:
        # 방수 우선: 제외하지 않고 방수 의류를 앞쪽으로 정렬한다 (FR-REC-02).
        candidates = sorted(candidates, key=lambda c: 0 if c.is_waterproof else 1)

    return FilterResult(
        candidates=candidates,
        outer_requirement=_determine_outer_requirement(context),
        rain_expected=rain_expected,
    )
