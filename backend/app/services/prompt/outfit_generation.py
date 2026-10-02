import re
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Literal

import pydantic

from app.services.preference_score import ClassificationResult
from app.services.prompt.template import load_prompt_template, render

PROMPT_NAME = "outfit_generation"
PROMPT_VERSION = "v1.0"

KST = timezone(timedelta(hours=9))

ItemSource = Literal["owned", "essential"]

CATEGORY_ORDER = ("outer", "top", "bottom", "shoes", "socks", "accessories")

# clothing_id와 essential_item_id는 서로 다른 테이블의 AUTO_INCREMENT라 같은 숫자가 나올 수 있어,
# 출처 접두사로 후보 id를 구분한다
_ITEM_ID_PREFIX = {"owned": "o", "essential": "e"}
_SOURCE_LABELS = {"owned": "보유", "essential": "에센셜"}
_SEASON_LABELS = {"spring": "봄", "summer": "여름", "fall": "가을", "winter": "겨울"}
_TPO_LABELS = {
    "daily": "데일리",
    "work": "출근",
    "formal": "격식(결혼식·면접)",
    "exercise": "운동",
    "rainy": "우천",
    "midwinter": "한겨울",
}
_WEATHER_CONDITION_LABELS = {
    "clear": "맑음",
    "cloudy": "구름많음",
    "overcast": "흐림",
    "rain": "비",
    "sleet": "비 또는 눈",
    "snow": "눈",
}
_TEMPERATURE_SENSITIVITY_LABELS = {
    "cold_sensitive": "추위를 많이 탐",
    "normal": "보통",
    "heat_sensitive": "더위를 많이 탐",
}
_GENDER_LABELS = {"male": "남성", "female": "여성", "unisex": "선택 안 함"}

_CONTROL_CHARS = re.compile(r"[\x00-\x1f\x7f-\x9f]")
_WHITESPACE = re.compile(r"\s+")


@dataclass(frozen=True)
class HourlyForecast:
    at: datetime
    temperature: float | Decimal
    feels_like_temperature: float | Decimal
    precipitation: float | Decimal
    weather_condition_cd: str


@dataclass(frozen=True)
class WeatherInput:
    temperature: float | Decimal
    feels_like_temperature: float | Decimal
    precipitation: float | Decimal
    wind_speed: float | Decimal
    weather_condition_cd: str
    min_feels_like_temperature: float | Decimal
    is_fallback: bool = False
    hourly: Sequence[HourlyForecast] = ()


@dataclass(frozen=True)
class CandidateItem:
    source: ItemSource
    item_id: int
    category_cd: str
    item_name: str | None
    color_cd: str | None
    style_cds: Sequence[str]
    thickness_cd: str | None
    is_recently_adopted: bool = False

    @property
    def key(self) -> str:
        return candidate_key(self.source, self.item_id)


@dataclass(frozen=True)
class KeptOutfit:
    outfit_seq: int
    item_keys: Sequence[str]


@dataclass(frozen=True)
class RegenerationInstruction:
    seq: int
    text: str


@dataclass(frozen=True)
class FailureReason:
    outfit_seq: int | None
    reason: str


@dataclass(frozen=True)
class OutfitPromptInput:
    weather: WeatherInput
    going_out_start_at: datetime
    going_out_end_at: datetime
    season_cd: str
    tpo_cd: str
    tpo_text: str | None
    temperature_sensitivity_cd: str | None
    birth_year: int | None
    gender_cd: str
    style_result: ClassificationResult
    color_result: ClassificationResult
    exploration_style: str | None
    is_outer_required: bool
    candidates: Sequence[CandidateItem]
    outfit_count: int
    kept_outfits: Sequence[KeptOutfit] = ()
    regeneration_instructions: Sequence[RegenerationInstruction] = ()
    failure_reasons: Sequence[FailureReason] = ()


@dataclass(frozen=True)
class AssembledPrompt:
    system: str
    user: str
    prompt_version: str


class GeneratedOutfit(pydantic.BaseModel):
    outfit_type: Literal["preferred", "exploratory"]
    item_ids: list[str]
    reason: str


class OutfitGenerationOutput(pydantic.BaseModel):
    outfits: list[GeneratedOutfit]


def candidate_key(source: ItemSource, item_id: int) -> str:
    return f"{_ITEM_ID_PREFIX[source]}{item_id}"


def sanitize_inline(text: str) -> str:
    text = _CONTROL_CHARS.sub(" ", text).replace("|", "/")
    return _WHITESPACE.sub(" ", text).strip()


def assemble_outfit_generation_prompt(data: OutfitPromptInput) -> AssembledPrompt:
    if data.style_result.attribute_type != "style":
        raise ValueError("style_result는 스타일 분류 결과여야 합니다.")
    if data.color_result.attribute_type != "color":
        raise ValueError("color_result는 색상 분류 결과여야 합니다.")
    if not 1 <= data.outfit_count <= 4:
        raise ValueError(f"outfit_count는 1~4여야 합니다: {data.outfit_count}")

    template = load_prompt_template(PROMPT_NAME, PROMPT_VERSION)
    start_at = _to_kst(data.going_out_start_at)
    end_at = _to_kst(data.going_out_end_at)
    candidates = _sort_candidates(data.candidates)

    values = {
        "weather": _format_weather(data.weather),
        "hourly_forecast": _format_hourly(data.weather.hourly, start_at, end_at),
        "going_out_time": f"{start_at:%H:%M}~{_format_clock(end_at, start_at)}",
        "season": f"{_label(_SEASON_LABELS, data.season_cd)} ({data.season_cd})",
        "tpo": _format_tpo(data.tpo_cd, data.tpo_text),
        "member_profile": _format_member_profile(data, start_at),
        "outer_required": "필수" if data.is_outer_required else "선택",
        "preferred_styles": _format_preferred(data.style_result),
        "preferred_colors": _format_preferred(data.color_result),
        "avoided_styles": ", ".join(sorted(data.style_result.avoided)) or None,
        "avoided_colors": ", ".join(sorted(data.color_result.avoided)) or None,
        "exploration_style": data.exploration_style,
        "candidates": _format_candidates(candidates),
        "recently_adopted": _text_or_none(
            ", ".join(c.key for c in candidates if c.is_recently_adopted)
        ),
        "kept_outfits": _format_kept_outfits(data.kept_outfits),
        "regeneration_instructions": _format_instructions(data.regeneration_instructions),
        "failure_reasons": _format_failure_reasons(data.failure_reasons),
        "outfit_composition": _format_composition(data.outfit_count, data.exploration_style),
    }
    return AssembledPrompt(
        system=render(template.system, {}),
        user=render(template.user, values),
        prompt_version=template.prompt_version,
    )


def _label(labels: dict[str, str], code: str) -> str:
    if code not in labels:
        raise ValueError(f"알 수 없는 코드값입니다: {code}")
    return labels[code]


def _to_kst(value: datetime) -> datetime:
    if value.tzinfo is None:
        raise ValueError("시각에는 타임존 정보가 있어야 합니다.")
    return value.astimezone(KST)


def _format_clock(at: datetime, start_at: datetime) -> str:
    prefix = "익일 " if at.date() > start_at.date() else ""
    return f"{prefix}{at:%H:%M}"


def _format_number(value: float | Decimal) -> str:
    text = f"{value:.1f}"
    return "0.0" if text == "-0.0" else text


def _text_or_none(text: str) -> str | None:
    return text or None


def _format_weather(weather: WeatherInput) -> str:
    lines = [
        f"- 기온 {_format_number(weather.temperature)}℃ "
        f"(체감 {_format_number(weather.feels_like_temperature)}℃), "
        f"{_label(_WEATHER_CONDITION_LABELS, weather.weather_condition_cd)}",
        f"- 강수 {_format_number(weather.precipitation)}mm, "
        f"풍속 {_format_number(weather.wind_speed)}m/s",
        f"- 외출 시간대 최저 체감온도 {_format_number(weather.min_feels_like_temperature)}℃",
    ]
    if weather.is_fallback:
        lines.append("- 기상 정보를 받지 못해 월별 평년 기온으로 대체한 값이다.")
    return "\n".join(lines)


def _format_hourly(
    hourly: Sequence[HourlyForecast], start_at: datetime, end_at: datetime
) -> str | None:
    window_start = start_at.replace(minute=0, second=0, microsecond=0)
    in_window = sorted(
        (h for h in hourly if window_start <= _to_kst(h.at) <= end_at), key=lambda h: h.at
    )
    return _text_or_none(
        "\n".join(
            f"- {_format_clock(_to_kst(h.at), start_at)} "
            f"{_format_number(h.temperature)}℃ (체감 {_format_number(h.feels_like_temperature)}℃), "
            f"{_label(_WEATHER_CONDITION_LABELS, h.weather_condition_cd)}, "
            f"강수 {_format_number(h.precipitation)}mm"
            for h in in_window
        )
    )


def _format_tpo(tpo_cd: str, tpo_text: str | None) -> str:
    if tpo_cd == "custom":
        text = sanitize_inline(tpo_text or "")
        if not text:
            raise ValueError("직접 입력한 TPO가 비었습니다.")
        return f'직접 입력: "{text}"'
    if tpo_text is not None:
        raise ValueError("프리셋 TPO에는 tpo_text를 함께 줄 수 없습니다.")
    return f"{_label(_TPO_LABELS, tpo_cd)} ({tpo_cd})"


def _format_member_profile(data: OutfitPromptInput, start_at: datetime) -> str:
    sensitivity = (
        _label(_TEMPERATURE_SENSITIVITY_LABELS, data.temperature_sensitivity_cd)
        if data.temperature_sensitivity_cd is not None
        else "-"
    )
    # 현재 시각 대신 외출 시작일의 연도를 써서 같은 입력이면 같은 프롬프트가 나오게 한다
    age_group = (
        f"{(start_at.year - data.birth_year) // 10 * 10}대" if data.birth_year is not None else "-"
    )
    return "\n".join(
        [
            f"- 체질: {sensitivity}",
            f"- 연령대: {age_group}",
            f"- 성별: {_label(_GENDER_LABELS, data.gender_cd)}",
        ]
    )


def _format_preferred(result: ClassificationResult) -> str | None:
    if not result.preference_injected:
        return None
    return _text_or_none(", ".join(result.preferred))


def _sort_candidates(candidates: Sequence[CandidateItem]) -> list[CandidateItem]:
    keys = [c.key for c in candidates]
    if len(keys) != len(set(keys)):
        raise ValueError("후보 목록에 같은 id가 두 번 있습니다.")
    for c in candidates:
        if c.category_cd not in CATEGORY_ORDER:
            raise ValueError(f"알 수 없는 코드값입니다: {c.category_cd}")

    return sorted(
        candidates,
        key=lambda c: (
            CATEGORY_ORDER.index(c.category_cd),
            c.is_recently_adopted,
            c.source != "owned",
            c.item_id,
        ),
    )


def _format_candidates(candidates: Sequence[CandidateItem]) -> str | None:
    return _text_or_none(
        "\n".join(
            " | ".join(
                [
                    f"id:{c.key}",
                    c.category_cd,
                    sanitize_inline(c.item_name or "") or "-",
                    c.color_cd or "-",
                    ",".join(sorted(set(c.style_cds))) or "-",
                    c.thickness_cd or "-",
                    _SOURCE_LABELS[c.source],
                ]
            )
            for c in candidates
        )
    )


def _format_kept_outfits(kept_outfits: Sequence[KeptOutfit]) -> str | None:
    return _text_or_none(
        "\n".join(
            f"- 세트 {k.outfit_seq}: {', '.join(sorted(k.item_keys))}"
            for k in sorted(kept_outfits, key=lambda k: k.outfit_seq)
        )
    )


def _format_instructions(instructions: Sequence[RegenerationInstruction]) -> str | None:
    return _text_or_none(
        "\n".join(
            f"- {_required_inline(i.text)}" for i in sorted(instructions, key=lambda i: i.seq)
        )
    )


def _format_failure_reasons(reasons: Sequence[FailureReason]) -> str | None:
    ordered = sorted(reasons, key=lambda r: (r.outfit_seq is not None, r.outfit_seq or 0, r.reason))
    return _text_or_none(
        "\n".join(
            f"- {'전체' if r.outfit_seq is None else f'세트 {r.outfit_seq}'}: "
            f"{_required_inline(r.reason)}"
            for r in ordered
        )
    )


def _required_inline(text: str) -> str:
    cleaned = sanitize_inline(text)
    if not cleaned:
        raise ValueError("빈 문장은 프롬프트에 넣을 수 없습니다.")
    return cleaned


def _format_composition(outfit_count: int, exploration_style: str | None) -> str:
    exploratory = 1 if exploration_style else 0
    preferred = outfit_count - exploratory
    parts = [f"preferred {preferred}벌"] if preferred else []
    if exploratory:
        parts.append(f"exploratory {exploratory}벌")
    return f"코디 세트 {outfit_count}벌을 만든다. {', '.join(parts)}."
