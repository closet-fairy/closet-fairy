import dataclasses
import json
import random
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path

import anthropic
import pydantic
import pytest

from app.services.prompt.outfit_generation import CandidateItem, HourlyForecast, WeatherInput
from app.services.prompt.outfit_review import (
    PROMPT_NAME,
    PROMPT_VERSION,
    OutfitReviewInput,
    OutfitReviewOutput,
    ReviewTarget,
    assemble_outfit_review_prompt,
)
from app.services.prompt.template import PROMPTS_DIR
from app.services.weather.base_time import KST

FIXTURES = Path(__file__).resolve().parent / "fixtures" / "prompts"


def kst(hour: int, minute: int = 0) -> datetime:
    return datetime(2026, 10, 3, hour, minute, tzinfo=KST)


CANDIDATES = (
    CandidateItem("essential", 6, "outer", "네이비 바람막이", "navy", ["sporty"], "thin"),
    CandidateItem("essential", 3, "outer", "네이비 블레이저", "navy", ["classic"], "medium"),
    CandidateItem("essential", 13, "top", "블랙 기능성 티셔츠", "black", ["sporty"], "thin"),
    CandidateItem(
        "owned", 2001, "top", "화이트 옥스퍼드 셔츠", "white", ["preppy", "classic"], "thin"
    ),
    CandidateItem("essential", 19, "bottom", "블랙 트레이닝 팬츠", "black", ["sporty"], "medium"),
    CandidateItem("essential", 14, "bottom", "블랙 슬랙스", "black", ["formal"], "medium"),
    CandidateItem("essential", 12, "bottom", "데님 팬츠", "blue", ["casual"], "medium"),
    CandidateItem("essential", 23, "shoes", "블랙 러닝화", "black", ["sporty"], None),
    CandidateItem("owned", 4001, "shoes", None, None, [], None),
    CandidateItem(
        "essential",
        29,
        "accessories",
        "블랙 가죽 벨트",
        "black",
        ["formal"],
        None,
        accessory_type_cd="belt",
    ),
)


def make_input(**overrides) -> OutfitReviewInput:
    fields = dict(
        weather=WeatherInput(
            temperature=Decimal("18.0"),
            feels_like_temperature=Decimal("17.2"),
            precipitation=0.0,
            wind_speed=2.4,
            weather_condition_cd="clear",
            min_feels_like_temperature=15.1,
            hourly=(
                HourlyForecast(kst(11), 16.0, 15.1, 0.0, "clear"),
                HourlyForecast(kst(12), 17.0, 16.3, 0.0, "clear"),
                HourlyForecast(kst(13), 18.0, 17.2, 0.0, "cloudy"),
                HourlyForecast(kst(15), 19.0, 18.5, 0.0, "cloudy"),
            ),
        ),
        going_out_start_at=kst(11, 30).astimezone(timezone.utc),
        going_out_end_at=kst(13).astimezone(timezone.utc),
        season_cd="fall",
        tpo_cd="formal",
        tpo_text=None,
        temperature_sensitivity_cd="normal",
        gender_cd="unisex",
        is_outer_required=True,
        candidates=CANDIDATES,
        outfits=(
            ReviewTarget(1, ["e6", "e13", "e19", "e23"]),
            ReviewTarget(2, ["e3", "o2001", "e14", "o4001", "e29"]),
        ),
    )
    return OutfitReviewInput(**{**fields, **overrides})


def section(user: str, heading: str) -> str:
    return user.split(f"## {heading}\n", 1)[1].split("\n\n## ", 1)[0]


def shuffled(items, rng: random.Random) -> list:
    items = list(items)
    rng.shuffle(items)
    return items


# ---------- 스냅샷 ----------


def test_system_prompt_matches_snapshot():
    prompt = assemble_outfit_review_prompt(make_input())

    assert prompt.system == (FIXTURES / "outfit_review_system.txt").read_text(encoding="utf-8")


def test_user_prompt_matches_snapshot():
    prompt = assemble_outfit_review_prompt(make_input())

    assert prompt.user == (FIXTURES / "outfit_review_user.txt").read_text(encoding="utf-8")


@pytest.mark.parametrize("seed", range(5))
def test_shuffled_input_order_gives_same_prompt(seed):
    rng = random.Random(seed)
    data = make_input()
    shuffled_data = dataclasses.replace(
        data,
        weather=dataclasses.replace(data.weather, hourly=shuffled(data.weather.hourly, rng)),
        candidates=shuffled(data.candidates, rng),
        outfits=[
            dataclasses.replace(o, item_keys=shuffled(o.item_keys, rng))
            for o in shuffled(data.outfits, rng)
        ],
    )

    assert assemble_outfit_review_prompt(shuffled_data) == assemble_outfit_review_prompt(data)


# ---------- 내용 ----------


def test_candidates_not_in_any_outfit_are_not_shown():
    user = assemble_outfit_review_prompt(make_input()).user

    assert "데님 팬츠" not in user


def test_outfit_lines_have_no_item_id():
    outfits = section(assemble_outfit_review_prompt(make_input()).user, "검사할 세트")

    assert "e13" not in outfits
    assert "o2001" not in outfits
    item_lines = [line for line in outfits.split("\n") if line.startswith("- ")]
    assert all(line.count(" | ") == 5 for line in item_lines)


def test_member_profile_has_no_age_group():
    profile = section(assemble_outfit_review_prompt(make_input()).user, "회원 정보")

    assert profile == "- 체질: 보통\n- 성별: 선택 안 함"


def test_preference_and_regeneration_headings_are_absent():
    user = assemble_outfit_review_prompt(make_input()).user

    for heading in ("선호", "기피", "탐색", "유지 중인 세트", "재추천", "실패 사유"):
        assert f"## {heading}" not in user


def test_custom_tpo_is_sanitized_and_quoted():
    data = make_input(tpo_cd="custom", tpo_text="친구 결혼식\n하객 | 낮")

    assert (
        section(assemble_outfit_review_prompt(data).user, "TPO")
        == '직접 입력: "친구 결혼식 하객 / 낮"'
    )


def test_item_name_is_sanitized_to_one_line():
    candidates = (
        *CANDIDATES[:2],
        dataclasses.replace(CANDIDATES[2], item_name="기능성\n티 | 블랙"),
        *CANDIDATES[3:],
    )
    outfits = section(
        assemble_outfit_review_prompt(make_input(candidates=candidates)).user, "검사할 세트"
    )

    assert "- top | 기능성 티 / 블랙 | black | sporty | thin | 에센셜" in outfits


# ---------- 아우터 표기 ----------


def test_optional_outer_without_outer_candidates_is_marked():
    candidates = tuple(c for c in CANDIDATES if c.category_cd != "outer")
    outfits = (ReviewTarget(1, ["e13", "e19", "e23"]),)
    data = make_input(is_outer_required=False, candidates=candidates, outfits=outfits)

    assert (
        section(assemble_outfit_review_prompt(data).user, "아우터") == "선택 (후보에 아우터 없음)"
    )


def test_optional_outer_with_unused_outer_candidate_is_not_marked():
    outfits = (ReviewTarget(1, ["e13", "e19", "e23"]),)
    data = make_input(is_outer_required=False, outfits=outfits)

    assert section(assemble_outfit_review_prompt(data).user, "아우터") == "선택"


def test_required_outer_without_outer_candidates_is_not_marked():
    candidates = tuple(c for c in CANDIDATES if c.category_cd != "outer")
    outfits = (ReviewTarget(1, ["e13", "e19", "e23"]),)
    data = make_input(is_outer_required=True, candidates=candidates, outfits=outfits)

    assert section(assemble_outfit_review_prompt(data).user, "아우터") == "필수"


# ---------- 잘못된 입력 ----------


def test_empty_outfits_are_rejected():
    with pytest.raises(ValueError):
        assemble_outfit_review_prompt(make_input(outfits=()))


@pytest.mark.parametrize("seqs", [(0,), (5,), (1, 1)])
def test_invalid_outfit_seq_is_rejected(seqs):
    outfits = tuple(ReviewTarget(seq, ["e13", "e19", "e23"]) for seq in seqs)

    with pytest.raises(ValueError):
        assemble_outfit_review_prompt(make_input(outfits=outfits))


def test_outfit_without_items_is_rejected():
    with pytest.raises(ValueError):
        assemble_outfit_review_prompt(make_input(outfits=(ReviewTarget(1, []),)))


def test_duplicated_item_in_outfit_is_rejected():
    with pytest.raises(ValueError):
        assemble_outfit_review_prompt(
            make_input(outfits=(ReviewTarget(1, ["e13", "e13", "e19", "e23"]),))
        )


@pytest.mark.parametrize("key", ["e999", "o13", "13"])
def test_item_not_in_candidates_is_rejected(key):
    with pytest.raises(ValueError):
        assemble_outfit_review_prompt(make_input(outfits=(ReviewTarget(1, [key, "e19", "e23"]),)))


def test_empty_candidates_are_rejected():
    with pytest.raises(ValueError):
        assemble_outfit_review_prompt(make_input(candidates=()))


def test_naive_datetime_is_rejected():
    with pytest.raises(ValueError):
        assemble_outfit_review_prompt(make_input(going_out_start_at=datetime(2026, 10, 3, 11)))


@pytest.mark.parametrize(
    ("tpo_cd", "tpo_text"), [("custom", None), ("custom", "  "), ("formal", "결혼식")]
)
def test_tpo_and_text_mismatch_is_rejected(tpo_cd, tpo_text):
    with pytest.raises(ValueError):
        assemble_outfit_review_prompt(make_input(tpo_cd=tpo_cd, tpo_text=tpo_text))


# ---------- 버전 · 스키마 ----------


def test_prompt_version_matches_template_folder():
    prompt = assemble_outfit_review_prompt(make_input())

    assert prompt.prompt_version == "outfit_review/v1.0"
    assert prompt.prompt_version == f"{PROMPT_NAME}/{PROMPT_VERSION}"
    assert (PROMPTS_DIR / PROMPT_NAME / PROMPT_VERSION).is_dir()


def test_schema_snapshot_matches_output_model():
    path = PROMPTS_DIR / PROMPT_NAME / PROMPT_VERSION / "schema.json"

    assert json.loads(path.read_text(encoding="utf-8")) == anthropic.transform_schema(
        OutfitReviewOutput
    )


def test_schema_puts_reason_before_pass():
    schema = anthropic.transform_schema(OutfitReviewOutput)
    review = schema["$defs"]["OutfitReview"]

    assert list(review["properties"]) == ["outfit_seq", "reason", "pass"]
    assert review["required"] == ["outfit_seq", "reason", "pass"]


def test_system_prompt_example_passes_output_model():
    system = assemble_outfit_review_prompt(make_input()).system
    example = system.split("## 출력 예시\n", 1)[1]

    output = OutfitReviewOutput.model_validate(json.loads(example), extra="forbid")

    assert [r.passed for r in output.reviews] == [False, True]


def test_python_field_name_is_not_accepted_as_output_key():
    payload = {"reviews": [{"outfit_seq": 1, "reason": "적합하다.", "passed": True}]}

    with pytest.raises(pydantic.ValidationError):
        OutfitReviewOutput.model_validate(payload, extra="forbid")
