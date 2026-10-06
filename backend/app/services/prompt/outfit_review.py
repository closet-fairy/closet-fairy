from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime

import pydantic

# 생성 프롬프트(#25)와 날씨·TPO 등의 문구를 똑같이 유지하려고 같은 패키지의 포맷터를 그대로 쓴다
from app.services.prompt.outfit_generation import (
    _GENDER_LABELS,
    _SEASON_LABELS,
    _SOURCE_LABELS,
    _TEMPERATURE_SENSITIVITY_LABELS,
    AssembledPrompt,
    CandidateItem,
    WeatherInput,
    _format_category,
    _format_clock,
    _format_hourly,
    _format_tpo,
    _format_weather,
    _label,
    _sort_candidates,
    _to_kst,
    sanitize_inline,
)
from app.services.prompt.template import load_prompt_template, render

PROMPT_NAME = "outfit_review"
PROMPT_VERSION = "v1.0"


@dataclass(frozen=True)
class ReviewTarget:
    outfit_seq: int
    item_keys: Sequence[str]


@dataclass(frozen=True)
class OutfitReviewInput:
    weather: WeatherInput
    going_out_start_at: datetime
    going_out_end_at: datetime
    season_cd: str
    tpo_cd: str
    tpo_text: str | None
    temperature_sensitivity_cd: str | None
    gender_cd: str
    is_outer_required: bool
    # 세트에 쓰인 아이템만이 아니라 후보 전체를 넘긴다. "후보에 아우터 없음" 판정에 쓰므로
    # 일부만 넘기면 아우터가 필요한 세트도 실패하지 않는다
    candidates: Sequence[CandidateItem]
    outfits: Sequence[ReviewTarget]


class OutfitReview(pydantic.BaseModel):
    outfit_seq: int
    reason: str
    passed: bool = pydantic.Field(alias="pass")


class OutfitReviewOutput(pydantic.BaseModel):
    reviews: list[OutfitReview]


def assemble_outfit_review_prompt(data: OutfitReviewInput) -> AssembledPrompt:
    if not data.outfits:
        raise ValueError("검사할 세트가 없습니다.")
    seqs = [o.outfit_seq for o in data.outfits]
    if any(not 1 <= seq <= 4 for seq in seqs) or len(seqs) != len(set(seqs)):
        raise ValueError(f"검사할 세트 번호는 1~4이고 서로 달라야 합니다: {seqs}")
    if not data.candidates:
        raise ValueError("후보 목록이 비었습니다.")

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
        "member_profile": _format_member_profile(data),
        "outer_required": _format_outer_required(data.is_outer_required, candidates),
        "outfits": _format_outfits(data.outfits, candidates),
    }
    return AssembledPrompt(
        system=render(template.system, {}),
        user=render(template.user, values),
        prompt_version=template.prompt_version,
    )


def _format_member_profile(data: OutfitReviewInput) -> str:
    sensitivity = (
        _label(_TEMPERATURE_SENSITIVITY_LABELS, data.temperature_sensitivity_cd)
        if data.temperature_sensitivity_cd is not None
        else "-"
    )
    return "\n".join(
        [
            f"- 체질: {sensitivity}",
            f"- 성별: {_label(_GENDER_LABELS, data.gender_cd)}",
        ]
    )


def _format_outer_required(is_required: bool, candidates: Sequence[CandidateItem]) -> str:
    if is_required:
        return "필수"
    if not any(c.category_cd == "outer" for c in candidates):
        return "선택 (후보에 아우터 없음)"
    return "선택"


def _format_outfits(outfits: Sequence[ReviewTarget], candidates: Sequence[CandidateItem]) -> str:
    known_keys = {c.key for c in candidates}
    blocks: list[str] = []
    for outfit in sorted(outfits, key=lambda o: o.outfit_seq):
        keys = set(outfit.item_keys)
        if not keys:
            raise ValueError(f"검사할 세트에 아이템이 없습니다: 세트 {outfit.outfit_seq}")
        if len(keys) != len(outfit.item_keys):
            raise ValueError(
                f"검사할 세트에 같은 아이템이 두 번 있습니다: 세트 {outfit.outfit_seq}"
            )
        unknown = sorted(keys - known_keys)
        if unknown:
            raise ValueError(f"후보 목록에 없는 아이템입니다: {unknown}")
        lines = [f"세트 {outfit.outfit_seq}"]
        lines.extend(f"- {_format_item(c)}" for c in candidates if c.key in keys)
        blocks.append("\n".join(lines))
    return "\n\n".join(blocks)


def _format_item(candidate: CandidateItem) -> str:
    return " | ".join(
        [
            _format_category(candidate),
            sanitize_inline(candidate.item_name or "") or "-",
            candidate.color_cd or "-",
            ",".join(sorted(set(candidate.style_cds))) or "-",
            candidate.thickness_cd or "-",
            _SOURCE_LABELS[candidate.source],
        ]
    )
