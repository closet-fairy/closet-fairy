import dataclasses
import json
import random
import re
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path

import anthropic
import pytest

from app.services.preference_score import ClassificationResult
from app.services.prompt.outfit_generation import (
    PROMPT_NAME,
    PROMPT_VERSION,
    CandidateItem,
    FailureReason,
    HourlyForecast,
    KeptOutfit,
    OutfitGenerationOutput,
    OutfitPromptInput,
    RegenerationInstruction,
    WeatherInput,
    assemble_outfit_generation_prompt,
)
from app.services.prompt.template import PROMPTS_DIR
from app.services.weather.base_time import KST
from app.services.weather.weather_service import condition_cd

FIXTURES = Path(__file__).resolve().parent / "fixtures" / "prompts"
REGENERATION_HEADINGS = {"## 유지 중인 세트", "## 재추천 지시", "## 직전 생성의 검증 실패 사유"}


def kst(hour: int, minute: int = 0, day: int = 2) -> datetime:
    return datetime(2026, 10, day, hour, minute, tzinfo=KST)


def style_result(**overrides) -> ClassificationResult:
    fields = dict(
        attribute_type="style",
        preference_injected=True,
        avoided=["street", "bohemian"],
        preferred=["classic", "minimal", "casual"],
        low_preferred=["chic", "formal"],
        neutral=[],
        preference_by_value={},
    )
    return ClassificationResult(**{**fields, **overrides})


def color_result(**overrides) -> ClassificationResult:
    fields = dict(
        attribute_type="color",
        preference_injected=True,
        avoided=["pink", "orange"],
        preferred=["navy", "black"],
        low_preferred=["white"],
        neutral=[],
        preference_by_value={},
    )
    return ClassificationResult(**{**fields, **overrides})


CANDIDATES = (
    CandidateItem(
        "owned", 1042, "outer", "네이비 블레이저", "navy", ["minimal", "classic"], "medium"
    ),
    CandidateItem("essential", 7, "outer", "베이지 트렌치코트", "beige", ["classic"], "medium"),
    CandidateItem(
        "owned",
        2001,
        "top",
        "화이트 옥스퍼드 셔츠",
        "white",
        ["classic", "preppy"],
        "thin",
        is_recently_adopted=True,
    ),
    CandidateItem("owned", 2002, "top", "그레이 니트", "gray", ["casual"], "medium"),
    CandidateItem("owned", 3001, "bottom", "블랙 슬랙스", "black", ["minimal"], "medium"),
    CandidateItem("essential", 12, "bottom", "데님 팬츠", "blue", ["casual"], "medium"),
    CandidateItem("owned", 4001, "shoes", None, None, [], None),
    CandidateItem("essential", 21, "shoes", "블랙 로퍼", "black", ["classic"], None),
    CandidateItem(
        "owned",
        5001,
        "accessories",
        "가죽 벨트",
        "brown",
        ["classic"],
        None,
        accessory_type_cd="belt",
    ),
)


def make_input(**overrides) -> OutfitPromptInput:
    fields = dict(
        weather=WeatherInput(
            temperature=Decimal("17.5"),
            feels_like_temperature=Decimal("16.2"),
            precipitation=0.0,
            wind_speed=2.1,
            weather_condition_cd="clear",
            min_feels_like_temperature=14.0,
            hourly=(
                HourlyForecast(kst(8), 15.0, 14.1, 0.0, "clear"),
                HourlyForecast(kst(9), 16.0, 15.2, 0.0, "clear"),
                HourlyForecast(kst(10), 17.5, 16.8, 0.0, "cloudy"),
                HourlyForecast(kst(11), 18.0, 17.1, 0.5, "rain"),
                HourlyForecast(kst(12), 19.0, 18.4, 0.0, "cloudy"),
            ),
        ),
        going_out_start_at=kst(9, 30).astimezone(timezone.utc),
        going_out_end_at=kst(11).astimezone(timezone.utc),
        season_cd="fall",
        tpo_cd="work",
        tpo_text=None,
        temperature_sensitivity_cd="cold_sensitive",
        birth_year=1999,
        gender_cd="unisex",
        style_result=style_result(),
        color_result=color_result(),
        exploration_style="chic",
        is_outer_required=True,
        candidates=CANDIDATES,
        outfit_count=4,
    )
    return OutfitPromptInput(**{**fields, **overrides})


def regeneration_input(**overrides) -> OutfitPromptInput:
    fields = dict(
        outfit_count=2,
        kept_outfits=(
            KeptOutfit(1, ["o3001", "e7", "o2002", "e21"], "preferred"),
            KeptOutfit(3, ["o1042", "o2001", "e12", "o4001"], "preferred"),
        ),
        regeneration_instructions=(
            RegenerationInstruction(1, "하의를 청바지 계열로 바꾼다."),
            RegenerationInstruction(2, "전체적으로 밝은 색을 쓴다."),
        ),
        failure_reasons=(
            FailureReason(4, "신발이 없다."),
            FailureReason(2, "상의가 두 개다."),
        ),
    )
    return make_input(**{**fields, **overrides})


def sections(prompt: str) -> list[str]:
    return re.split(r"\n(?=## )", prompt)


def heading(section: str) -> str:
    return section.split("\n", 1)[0]


def candidate_lines(prompt: str) -> list[str]:
    return [line for line in prompt.split("\n") if line.startswith("id:")]


def shuffled(items, rng: random.Random) -> list:
    items = list(items)
    rng.shuffle(items)
    return items


# ---------- 스냅샷 ----------


def test_system_prompt_matches_snapshot():
    prompt = assemble_outfit_generation_prompt(make_input())

    assert prompt.system == (FIXTURES / "outfit_generation_system.txt").read_text(encoding="utf-8")


def test_initial_user_prompt_matches_snapshot():
    prompt = assemble_outfit_generation_prompt(make_input())

    assert prompt.user == (FIXTURES / "outfit_generation_initial.txt").read_text(encoding="utf-8")


def test_regeneration_user_prompt_matches_snapshot():
    prompt = assemble_outfit_generation_prompt(regeneration_input())

    assert prompt.user == (FIXTURES / "outfit_generation_regeneration.txt").read_text(
        encoding="utf-8"
    )


@pytest.mark.parametrize("seed", range(5))
def test_shuffled_input_order_gives_same_prompt(seed):
    rng = random.Random(seed)
    data = regeneration_input()
    weather = dataclasses.replace(data.weather, hourly=shuffled(data.weather.hourly, rng))
    shuffled_data = dataclasses.replace(
        data,
        weather=weather,
        candidates=shuffled(data.candidates, rng),
        style_result=style_result(avoided=shuffled(data.style_result.avoided, rng)),
        color_result=color_result(avoided=shuffled(data.color_result.avoided, rng)),
        kept_outfits=[
            dataclasses.replace(k, item_keys=shuffled(k.item_keys, rng))
            for k in shuffled(data.kept_outfits, rng)
        ],
        regeneration_instructions=shuffled(data.regeneration_instructions, rng),
        failure_reasons=shuffled(data.failure_reasons, rng),
    )

    assert assemble_outfit_generation_prompt(shuffled_data) == assemble_outfit_generation_prompt(
        data
    )


# ---------- 최초 추천 / 재추천 ----------


def test_initial_prompt_has_no_regeneration_or_failure_blocks():
    user = assemble_outfit_generation_prompt(make_input()).user

    assert {heading(s) for s in sections(user)} & REGENERATION_HEADINGS == set()
    assert "{{" not in user


def test_regeneration_adds_only_regeneration_blocks():
    initial = assemble_outfit_generation_prompt(make_input(outfit_count=2)).user
    regeneration = assemble_outfit_generation_prompt(regeneration_input()).user

    added = [s for s in sections(regeneration) if heading(s) in REGENERATION_HEADINGS]
    base = [s for s in sections(regeneration) if heading(s) not in REGENERATION_HEADINGS]

    assert {heading(s) for s in added} == REGENERATION_HEADINGS
    assert base == sections(initial)


def test_regeneration_blocks_follow_seq_order():
    user = assemble_outfit_generation_prompt(regeneration_input()).user

    assert "- 세트 1: e21, e7, o2002, o3001\n- 세트 3: e12, o1042, o2001, o4001" in user
    assert "- 하의를 청바지 계열로 바꾼다.\n- 전체적으로 밝은 색을 쓴다." in user
    assert "- 세트 2: 상의가 두 개다.\n- 세트 4: 신발이 없다." in user


def test_kept_exploratory_with_exploration_style_is_rejected():
    data = regeneration_input(
        outfit_count=1,
        kept_outfits=(
            KeptOutfit(1, ["o3001", "e7"], "preferred"),
            KeptOutfit(2, ["o2002", "e21"], "preferred"),
            KeptOutfit(3, ["o1042", "e12"], "exploratory"),
        ),
    )

    with pytest.raises(ValueError, match="이미 탐색 코디가 있어"):
        assemble_outfit_generation_prompt(data)


def test_two_kept_exploratory_outfits_are_rejected():
    data = regeneration_input(
        exploration_style=None,
        kept_outfits=(
            KeptOutfit(1, ["o3001", "e7"], "exploratory"),
            KeptOutfit(3, ["o1042", "e12"], "exploratory"),
        ),
    )

    with pytest.raises(ValueError, match="2벌 이상"):
        assemble_outfit_generation_prompt(data)


def test_kept_without_exploratory_creates_one_exploratory():
    user = assemble_outfit_generation_prompt(regeneration_input()).user

    assert "## 탐색 스타일\nchic\n" in user
    assert user.endswith("코디 세트 2벌을 만든다. preferred 1벌, exploratory 1벌.")


def test_kept_exploratory_without_exploration_style_creates_preferred_only():
    data = regeneration_input(
        exploration_style=None,
        kept_outfits=(
            KeptOutfit(1, ["o3001", "e7"], "preferred"),
            KeptOutfit(3, ["o1042", "e12"], "exploratory"),
        ),
    )

    user = assemble_outfit_generation_prompt(data).user

    assert user.endswith("코디 세트 2벌을 만든다. preferred 2벌.")


def test_unknown_kept_outfit_type_is_rejected():
    data = regeneration_input(kept_outfits=(KeptOutfit(1, ["o3001"], "explore"),))

    with pytest.raises(ValueError, match="알 수 없는 코드값입니다: explore"):
        assemble_outfit_generation_prompt(data)


@pytest.mark.parametrize("seqs", [(0, 1), (1, 5), (2, 2)])
def test_invalid_kept_outfit_seq_is_rejected(seqs):
    data = regeneration_input(
        kept_outfits=tuple(KeptOutfit(seq, ["o3001"], "preferred") for seq in seqs)
    )

    with pytest.raises(ValueError, match="세트 번호"):
        assemble_outfit_generation_prompt(data)


def test_duplicate_regeneration_instruction_seq_is_rejected():
    data = regeneration_input(
        regeneration_instructions=(
            RegenerationInstruction(1, "하의를 바꾼다."),
            RegenerationInstruction(1, "밝은 색을 쓴다."),
        )
    )

    with pytest.raises(ValueError, match="재추천 지시 번호"):
        assemble_outfit_generation_prompt(data)


def test_empty_kept_outfit_items_are_rejected():
    data = regeneration_input(kept_outfits=(KeptOutfit(1, [], "preferred"),))

    with pytest.raises(ValueError, match="아이템이 없습니다"):
        assemble_outfit_generation_prompt(data)


@pytest.mark.parametrize("seq", [0, 5])
def test_failure_reason_seq_out_of_range_is_rejected(seq):
    data = make_input(failure_reasons=(FailureReason(seq, "신발이 없다."),))

    with pytest.raises(ValueError, match="실패 사유의 세트 번호"):
        assemble_outfit_generation_prompt(data)


@pytest.mark.parametrize("key", ["1042", "x7", "o", "o12a"])
def test_invalid_kept_outfit_key_is_rejected(key):
    data = regeneration_input(kept_outfits=(KeptOutfit(1, ["o1042", key], "preferred"),))

    with pytest.raises(ValueError, match="아이템 키 형식"):
        assemble_outfit_generation_prompt(data)


def test_failure_reason_without_outfit_comes_first():
    data = make_input(
        failure_reasons=(FailureReason(1, "아우터 누락"), FailureReason(None, "중복"))
    )

    user = assemble_outfit_generation_prompt(data).user

    assert "- 전체: 중복\n- 세트 1: 아우터 누락" in user


# ---------- 선호 · 탐색 ----------


def test_preferred_keeps_classification_order():
    user = assemble_outfit_generation_prompt(make_input()).user

    assert "## 선호 스타일 (선호도 높은 순)\nclassic, minimal, casual\n" in user
    assert "## 선호 색상 (선호도 높은 순)\nnavy, black\n" in user


def test_avoided_is_sorted_alphabetically():
    user = assemble_outfit_generation_prompt(make_input()).user

    assert "## 기피 스타일\nbohemian, street\n" in user
    assert "## 기피 색상\norange, pink\n" in user


def test_low_preferred_is_not_in_prompt():
    user = assemble_outfit_generation_prompt(make_input()).user

    assert "저선호" not in user
    assert "formal" not in user.split("## 후보 목록")[0]


def test_preference_not_injected_removes_preferred_block_but_keeps_avoided():
    data = make_input(
        style_result=style_result(
            preference_injected=False, preferred=[], low_preferred=[], neutral=["casual"]
        ),
        exploration_style=None,
    )

    user = assemble_outfit_generation_prompt(data).user

    assert "## 선호 스타일" not in user
    assert "## 선호 색상 (선호도 높은 순)" in user
    assert "## 기피 스타일\nbohemian, street\n" in user


def test_no_avoided_removes_avoided_block():
    data = make_input(style_result=style_result(avoided=[]), color_result=color_result(avoided=[]))

    user = assemble_outfit_generation_prompt(data).user

    assert "## 기피" not in user


def test_exploration_style_sets_one_exploratory_outfit():
    user = assemble_outfit_generation_prompt(make_input()).user

    assert "## 탐색 스타일\nchic\n" in user
    assert user.endswith("코디 세트 4벌을 만든다. preferred 3벌, exploratory 1벌.")


def test_no_exploration_style_fills_with_preferred():
    user = assemble_outfit_generation_prompt(make_input(exploration_style=None)).user

    assert "## 탐색 스타일" not in user
    assert user.endswith("코디 세트 4벌을 만든다. preferred 4벌.")


def test_single_exploratory_regeneration():
    user = assemble_outfit_generation_prompt(make_input(outfit_count=1)).user

    assert user.endswith("코디 세트 1벌을 만든다. exploratory 1벌.")


@pytest.mark.parametrize("count", [0, 5])
def test_outfit_count_out_of_range_is_rejected(count):
    with pytest.raises(ValueError, match="outfit_count"):
        assemble_outfit_generation_prompt(make_input(outfit_count=count))


def test_outfit_count_plus_kept_outfits_over_four_is_rejected():
    with pytest.raises(ValueError, match="합은 4 이하"):
        assemble_outfit_generation_prompt(regeneration_input(outfit_count=3))


def test_swapped_classification_results_are_rejected():
    with pytest.raises(ValueError, match="style_result"):
        assemble_outfit_generation_prompt(make_input(style_result=color_result()))


# ---------- 후보 목록 ----------


def test_candidate_lines_are_sorted_by_category_recency_source_and_id():
    user = assemble_outfit_generation_prompt(make_input()).user

    assert [line.split(" | ")[0] for line in candidate_lines(user)] == [
        "id:o1042",
        "id:e7",
        "id:o2002",
        "id:o2001",
        "id:o3001",
        "id:e12",
        "id:o4001",
        "id:e21",
        "id:o5001",
    ]


def test_candidate_line_format():
    lines = candidate_lines(assemble_outfit_generation_prompt(make_input()).user)

    assert lines[0] == "id:o1042 | outer | 네이비 블레이저 | navy | classic,minimal | medium | 보유"
    assert (
        lines[3] == "id:o2001 | top | 화이트 옥스퍼드 셔츠 | white | classic,preppy | thin | 보유"
    )
    assert lines[6] == "id:o4001 | shoes | - | - | - | - | 보유"
    assert lines[7] == "id:e21 | shoes | 블랙 로퍼 | black | classic | - | 에센셜"


def test_every_candidate_line_has_seven_columns():
    lines = candidate_lines(assemble_outfit_generation_prompt(make_input()).user)

    assert len(lines) == len(CANDIDATES)
    assert all(len(line.split(" | ")) == 7 for line in lines)


def test_recently_adopted_goes_last_within_category():
    data = make_input(
        candidates=(
            CandidateItem(
                "owned", 1, "top", "니트", "gray", ["casual"], "medium", is_recently_adopted=True
            ),
            CandidateItem("owned", 2, "top", "셔츠", "white", ["classic"], "thin"),
            CandidateItem("essential", 3, "top", "티셔츠", "black", ["casual"], "thin"),
            CandidateItem(
                "owned", 4, "outer", "자켓", "navy", ["classic"], "medium", is_recently_adopted=True
            ),
        )
    )

    ids = [
        line.split(" | ")[0]
        for line in candidate_lines(assemble_outfit_generation_prompt(data).user)
    ]

    assert ids == ["id:o4", "id:o2", "id:e3", "id:o1"]


def test_recently_adopted_block_lists_keys_in_candidate_order():
    data = make_input(
        candidates=CANDIDATES
        + (
            CandidateItem(
                "essential",
                30,
                "outer",
                "블랙 패딩",
                "black",
                ["casual"],
                "thick",
                is_recently_adopted=True,
            ),
        )
    )

    user = assemble_outfit_generation_prompt(data).user

    assert "## 최근 채택한 옷\ne30, o2001\n" in user


def test_no_recently_adopted_removes_block_with_heading():
    candidates = tuple(dataclasses.replace(c, is_recently_adopted=False) for c in CANDIDATES)

    user = assemble_outfit_generation_prompt(make_input(candidates=candidates)).user

    assert "최근 채택" not in user
    assert "## 후보 목록" in user


def test_same_number_in_owned_and_essential_gets_distinct_ids():
    data = make_input(
        candidates=CANDIDATES
        + (CandidateItem("essential", 1042, "outer", "블랙 패딩", "black", ["casual"], "thick"),)
    )

    ids = [
        line.split(" | ")[0]
        for line in candidate_lines(assemble_outfit_generation_prompt(data).user)
    ]

    assert "id:o1042" in ids and "id:e1042" in ids


def test_duplicate_candidate_is_rejected():
    with pytest.raises(ValueError, match="같은 id"):
        assemble_outfit_generation_prompt(make_input(candidates=CANDIDATES + CANDIDATES[:1]))


@pytest.mark.parametrize(
    ("name", "expected"),
    [
        ("청바지 | 블랙", "청바지 / 블랙"),
        ("줄바꿈\n있는\r\n이름", "줄바꿈 있는 이름"),
        ("탭\t과   공백  ", "탭 과 공백"),
        ("| \n |", "/ /"),
        ("  \n\t ", "-"),
        ("{{candidates}} 슬롯 흉내", "{{candidates}} 슬롯 흉내"),
    ],
)
def test_candidate_name_is_sanitized_to_one_line(name, expected):
    data = make_input(
        candidates=(CandidateItem("owned", 1, "top", name, "white", ["casual"], "thin"),)
    )

    lines = candidate_lines(assemble_outfit_generation_prompt(data).user)

    assert len(lines) == 1
    assert lines[0].split(" | ")[2] == expected
    assert len(lines[0].split(" | ")) == 7


def test_accessory_type_is_attached_to_category():
    lines = candidate_lines(assemble_outfit_generation_prompt(make_input()).user)

    assert lines[8] == "id:o5001 | accessories:belt | 가죽 벨트 | brown | classic | - | 보유"


def test_accessory_without_type_shows_category_only():
    data = make_input(
        candidates=(CandidateItem("owned", 1, "accessories", "반지", "gray", [], None),)
    )

    lines = candidate_lines(assemble_outfit_generation_prompt(data).user)

    assert lines == ["id:o1 | accessories | 반지 | gray | - | - | 보유"]


def test_accessory_type_on_non_accessory_is_rejected():
    data = make_input(
        candidates=(
            CandidateItem("owned", 1, "top", "셔츠", "white", [], "thin", accessory_type_cd="belt"),
        )
    )

    with pytest.raises(ValueError, match="악세서리가 아닌 후보"):
        assemble_outfit_generation_prompt(data)


def test_unknown_accessory_type_is_rejected():
    data = make_input(
        candidates=(
            CandidateItem(
                "owned", 1, "accessories", "?", "gray", [], None, accessory_type_cd="ring"
            ),
        )
    )

    with pytest.raises(ValueError, match="알 수 없는 코드값입니다: ring"):
        assemble_outfit_generation_prompt(data)


def test_empty_candidates_is_rejected():
    with pytest.raises(ValueError, match="후보 목록이 비었습니다"):
        assemble_outfit_generation_prompt(make_input(candidates=()))


# ---------- 기본 슬롯 ----------


def test_weather_and_time_are_formatted_in_kst():
    user = assemble_outfit_generation_prompt(make_input()).user

    assert "## 외출 시간\n09:30~11:00\n" in user
    assert "- 기온 17.5℃ (체감 16.2℃), 맑음\n- 강수 0.0mm, 풍속 2.1m/s\n" in user
    assert "- 외출 시간대 최저 체감온도 14.0℃" in user


def test_hourly_forecast_only_includes_going_out_window():
    user = assemble_outfit_generation_prompt(make_input()).user

    assert (
        "## 외출 시간대 예보\n"
        "- 09:00 16.0℃ (체감 15.2℃), 맑음, 강수 0.0mm\n"
        "- 10:00 17.5℃ (체감 16.8℃), 구름많음, 강수 0.0mm\n"
        "- 11:00 18.0℃ (체감 17.1℃), 비, 강수 0.5mm\n"
    ) in user


def test_fallback_weather_without_hourly_removes_hourly_block():
    weather = WeatherInput(10.0, 8.0, 0.0, 0.0, "clear", 8.0, is_fallback=True)

    user = assemble_outfit_generation_prompt(make_input(weather=weather)).user

    assert "## 외출 시간대 예보" not in user
    assert "- 기상 정보를 받지 못해 월별 평년 기온으로 대체한 값이다." in user


def test_going_out_past_midnight():
    data = make_input(going_out_start_at=kst(22), going_out_end_at=kst(2, day=3))

    user = assemble_outfit_generation_prompt(data).user

    assert "## 외출 시간\n22:00~익일 02:00\n" in user


def test_naive_datetime_is_rejected():
    with pytest.raises(ValueError, match="타임존"):
        assemble_outfit_generation_prompt(make_input(going_out_start_at=datetime(2026, 10, 2, 9)))


def test_member_profile_uses_going_out_year_and_unisex_label():
    user = assemble_outfit_generation_prompt(make_input()).user

    assert "- 체질: 추위를 많이 탐\n- 연령대: 20대\n- 성별: 선택 안 함" in user


def test_member_profile_null_values_use_dash():
    data = make_input(temperature_sensitivity_cd=None, birth_year=None, gender_cd="female")

    user = assemble_outfit_generation_prompt(data).user

    assert "- 체질: -\n- 연령대: -\n- 성별: 여성" in user


def test_custom_tpo_is_sanitized_and_quoted():
    data = make_input(tpo_cd="custom", tpo_text="소개팅 |\n저녁 식사")

    user = assemble_outfit_generation_prompt(data).user

    assert '## TPO\n직접 입력: "소개팅 / 저녁 식사"\n' in user


@pytest.mark.parametrize(
    ("tpo_cd", "tpo_text"), [("custom", None), ("custom", " \n "), ("work", "출근")]
)
def test_tpo_and_text_mismatch_is_rejected(tpo_cd, tpo_text):
    with pytest.raises(ValueError):
        assemble_outfit_generation_prompt(make_input(tpo_cd=tpo_cd, tpo_text=tpo_text))


def test_unknown_code_is_rejected():
    with pytest.raises(ValueError, match="알 수 없는 코드값"):
        assemble_outfit_generation_prompt(make_input(season_cd="monsoon"))


WEATHER_CONDITION_LABELS = {
    "clear": "맑음",
    "cloudy": "구름많음",
    "overcast": "흐림",
    "rain": "비",
    "sleet": "비 또는 눈",
    "snow": "눈",
}


@pytest.mark.parametrize(("code", "label"), WEATHER_CONDITION_LABELS.items())
def test_every_weather_condition_has_label(code, label):
    weather = WeatherInput(10.0, 8.0, 0.0, 0.0, code, 8.0)

    user = assemble_outfit_generation_prompt(make_input(weather=weather)).user

    assert f"- 기온 10.0℃ (체감 8.0℃), {label}\n" in user


def test_weather_service_codes_match_labeled_codes():
    produced = {condition_cd(pty, sky) for pty in range(8) for sky in (None, 1, 2, 3, 4)}

    assert produced == WEATHER_CONDITION_LABELS.keys()


# ---------- 버전 · 스키마 ----------


def test_prompt_version_matches_template_folder():
    prompt = assemble_outfit_generation_prompt(make_input())

    assert prompt.prompt_version == "outfit_generation/v1.0"
    assert prompt.prompt_version == f"{PROMPT_NAME}/{PROMPT_VERSION}"
    assert (PROMPTS_DIR / PROMPT_NAME / PROMPT_VERSION).is_dir()


def test_schema_snapshot_matches_output_model():
    path = PROMPTS_DIR / PROMPT_NAME / PROMPT_VERSION / "schema.json"

    assert json.loads(path.read_text(encoding="utf-8")) == anthropic.transform_schema(
        OutfitGenerationOutput
    )


def test_system_prompt_example_passes_output_model():
    system = assemble_outfit_generation_prompt(make_input()).system
    example = system.split("## 출력 예시\n", 1)[1]

    OutfitGenerationOutput.model_validate(json.loads(example), extra="forbid")
