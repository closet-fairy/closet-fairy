"""추천 파이프라인 연결 테스트. DB·LLM은 가짜로 바꿔 끼운다."""

import random
import re
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock

from app.core.config import get_settings
from app.repositories.clothing import ClothingCandidate
from app.repositories.preference_score import PreferenceRow
from app.services import recommendation_pipeline as pipeline
from app.services.essential_supplement import SupplementedCandidate, SupplementResult
from app.services.llm import LLMClient
from app.services.outfit_generator import DraftOutfit, GenerationResult
from app.services.preference_score import classify
from app.services.prompt.outfit_generation import OutfitGenerationOutput
from app.services.prompt.outfit_review import OutfitReviewOutput
from app.services.recommend_context import RecommendContext
from app.services.weather.base_time import KST
from app.services.weather.weather_service import HourlyWeather, WeatherResult

START = datetime(2026, 10, 8, 8, 0, tzinfo=KST)


def _weather() -> WeatherResult:
    return WeatherResult(
        temperature=14.0,
        feels_like_temperature=12.5,
        precipitation=0.0,
        wind_speed=2.0,
        weather_condition_cd="cloudy",
        min_feels_like_temperature=9.0,
        hourly=[
            HourlyWeather(START + timedelta(hours=h), 10.0 + h, 9.0 + h, 0.0, 2.0, "cloudy")
            for h in range(3)
        ],
    )


def _context(clothing: list[ClothingCandidate] | None = None) -> RecommendContext:
    return RecommendContext(
        recommendation_session_id=7,
        member_id=1,
        going_out_start_at=START,
        going_out_end_at=START + timedelta(hours=2),
        season_cd="fall",
        tpo_cd="work",
        tpo_text=None,
        tpo_input_type_cd="preset",
        weather=_weather(),
        birth_year=1999,
        temperature_sensitivity_cd="normal",
        gender_cd="unisex",
        preferred_styles=[],
        clothing=clothing or [],
    )


def _supplemented(
    item_id: int, category_cd: str, source_cd: str = "owned", seasons: list[str] | None = None
) -> SupplementedCandidate:
    return SupplementedCandidate(
        item_id=item_id,
        source_cd=source_cd,
        category_cd=category_cd,
        accessory_type_cd=None,
        item_name=f"item-{item_id}",
        color_cd="black",
        styles=["minimal"],
        thickness_cd="medium",
        is_waterproof=False,
        seasons=seasons or [],
    )


def _supplement(outer_requirement="optional", shortage=False) -> SupplementResult:
    return SupplementResult(
        candidates=[
            _supplemented(1042, "top", seasons=["fall"]),
            _supplemented(2, "bottom", source_cd="essential"),
            _supplemented(3, "shoes", source_cd="essential"),
        ],
        is_clothing_shortage=shortage,
        outer_requirement=outer_requirement,
    )


def _row(value: str, score: str, exposure: str, seq: int) -> PreferenceRow:
    return PreferenceRow(value, Decimal(score), Decimal(exposure), seq)


NO_PREFERENCE = {
    "style": [_row("minimal", "0", "0", 1), _row("casual", "0", "0", 2)],
    "color": [_row("black", "0", "0", 1), _row("white", "0", "0", 2)],
}


# ---------- 생성 입력 조립 ----------


def _preferences() -> pipeline.Preferences:
    settings = get_settings()
    return pipeline.Preferences(
        classify("style", NO_PREFERENCE["style"], settings),
        classify("color", NO_PREFERENCE["color"], settings),
        exploration_style=None,
    )


def test_build_prompt_input_converts_candidates_with_keys_and_seasons():
    prompt_input = pipeline.build_prompt_input(_context(), _supplement(), _preferences())

    keys = [c.key for c in prompt_input.candidates]
    assert keys == ["o1042", "e2", "e3"]
    assert list(prompt_input.candidates[0].seasons) == ["fall"]
    assert prompt_input.outfit_count == 4


def test_outer_required_follows_supplement_not_filter():
    # 보충 단계가 필수 아우터를 채우지 못해 optional로 낮춘 최종값을 써야 한다
    optional = pipeline.build_prompt_input(
        _context(), _supplement(outer_requirement="optional"), _preferences()
    )
    required = pipeline.build_prompt_input(
        _context(), _supplement(outer_requirement="required"), _preferences()
    )

    assert optional.is_outer_required is False
    assert required.is_outer_required is True


def test_weather_is_converted_with_hourly_forecast():
    prompt_input = pipeline.build_prompt_input(_context(), _supplement(), _preferences())

    weather = prompt_input.weather
    assert weather.min_feels_like_temperature == 9.0
    assert [h.at for h in weather.hourly] == [START + timedelta(hours=h) for h in range(3)]
    assert weather.hourly[0].feels_like_temperature == 9.0


# ---------- 선호도 ----------


class _FakeDb:
    pass


async def test_new_member_gets_no_exploration_style(monkeypatch):
    async def fake_scores(db, member_id):
        return NO_PREFERENCE

    async def fail_count(db, member_id):
        raise AssertionError("선호 정보가 없으면 세션 수를 조회하지 않는다")

    monkeypatch.setattr(pipeline.preference_repo, "find_preference_scores", fake_scores)
    monkeypatch.setattr(pipeline.preference_repo, "count_settled_sessions", fail_count)

    preferences = await pipeline.load_preferences(_FakeDb(), 1, random.Random(0))

    assert preferences.style_result.preference_injected is False
    assert preferences.exploration_style is None


async def test_exploration_style_is_picked_when_preference_exists(monkeypatch):
    styles = [
        _row("minimal", "6", "4", 1),
        _row("casual", "3", "4", 2),
        _row("street", "0", "1", 3),
        _row("chic", "-1", "1", 4),
    ]

    async def fake_scores(db, member_id):
        return {"style": styles, "color": NO_PREFERENCE["color"]}

    async def fake_count(db, member_id):
        return 5

    monkeypatch.setattr(pipeline.preference_repo, "find_preference_scores", fake_scores)
    monkeypatch.setattr(pipeline.preference_repo, "count_settled_sessions", fake_count)

    preferences = await pipeline.load_preferences(_FakeDb(), 1, random.Random(0))

    assert preferences.style_result.preference_injected is True
    assert preferences.exploration_style not in preferences.style_result.preferred
    assert preferences.exploration_style is not None


# ---------- 연결 ----------


@asynccontextmanager
async def _fake_session():
    yield _FakeDb()


def _generation() -> GenerationResult:
    outfits = [DraftOutfit(i, "preferred", ("o1042", "e2", "e3"), "이유") for i in (1, 2, 3)]
    return GenerationResult(
        outfits=outfits,
        rounds=1,
        hard_rule_retries=0,
        reviewer_retries=0,
        shortfall_retries=0,
        fallback_count=0,
    )


async def test_recommend_wires_all_checks_with_same_prompt_input(monkeypatch):
    captured = {}

    async def fake_collect(context, filter_result):
        return _supplement(outer_requirement="required")

    async def fake_load(db, member_id, rng):
        return _preferences()

    async def fake_generate(llm, prompt_input, **kwargs):
        captured["prompt_input"] = prompt_input
        captured["kwargs"] = kwargs
        return _generation()

    monkeypatch.setattr(pipeline, "collect_essential_candidates", fake_collect)
    monkeypatch.setattr(pipeline, "load_preferences", fake_load)
    monkeypatch.setattr(pipeline, "generate_outfits", fake_generate)
    monkeypatch.setattr(pipeline, "AsyncSessionLocal", _fake_session)

    outcome = await pipeline.recommend(_context(), MagicMock(spec=LLMClient))

    assert captured["prompt_input"].is_outer_required is True
    assert set(captured["kwargs"]) >= {"hard_rule", "review", "fallback", "session_id"}
    assert captured["kwargs"]["session_id"] == 7
    assert len(outcome.generation.outfits) == 3


def _outcome(generation: GenerationResult, shortage: bool = False) -> pipeline.RecommendOutcome:
    return pipeline.RecommendOutcome(
        generation=generation,
        supplement=_supplement(shortage=shortage),
        prompt_input=None,
        owned_count=0,
        filtered_owned_count=0,
    )


def _patch_run(monkeypatch, outcome: pipeline.RecommendOutcome | Exception):
    calls = {"saved": [], "failed": []}

    async def fake_collect_context(session_id):
        return _context()

    async def fake_recommend(context, llm):
        if isinstance(outcome, Exception):
            raise outcome
        return outcome

    async def fake_save(session_id, member_id, outfits, supplement):
        calls["saved"].append((session_id, member_id, list(outfits), supplement))

    async def fake_mark_failed(session_id, is_clothing_shortage=None):
        calls["failed"].append((session_id, is_clothing_shortage))

    monkeypatch.setattr(pipeline, "collect_context", fake_collect_context)
    monkeypatch.setattr(pipeline, "recommend", fake_recommend)
    monkeypatch.setattr(pipeline, "save_recommendation_result", fake_save)
    monkeypatch.setattr(pipeline, "mark_generation_failed", fake_mark_failed)
    return calls


async def test_pipeline_saves_generated_outfits(monkeypatch):
    outcome = _outcome(_generation(), shortage=True)
    calls = _patch_run(monkeypatch, outcome)

    await pipeline.run_recommendation_pipeline(7, MagicMock(spec=LLMClient))

    assert calls["saved"] == [(7, 1, outcome.generation.outfits, outcome.supplement)]
    assert calls["failed"] == []


async def test_pipeline_marks_failed_with_shortage_when_no_outfits(monkeypatch):
    empty = GenerationResult(
        outfits=[],
        rounds=3,
        hard_rule_retries=2,
        reviewer_retries=0,
        shortfall_retries=0,
        fallback_count=0,
    )
    calls = _patch_run(monkeypatch, _outcome(empty, shortage=True))

    await pipeline.run_recommendation_pipeline(7, MagicMock(spec=LLMClient))

    assert calls["saved"] == []
    assert calls["failed"] == [(7, True)]


async def test_pipeline_marks_failed_without_shortage_when_recommend_raises(monkeypatch, caplog):
    calls = _patch_run(monkeypatch, RuntimeError("boom"))

    await pipeline.run_recommendation_pipeline(7, MagicMock(spec=LLMClient))

    assert "recommend.pipeline.failed" in caplog.text
    assert calls["saved"] == []
    assert calls["failed"] == [(7, None)]


async def test_pipeline_marks_failed_when_save_raises(monkeypatch):
    calls = _patch_run(monkeypatch, _outcome(_generation()))

    async def failing_save(session_id, member_id, outfits, supplement):
        raise RuntimeError("db down")

    monkeypatch.setattr(pipeline, "save_recommendation_result", failing_save)

    await pipeline.run_recommendation_pipeline(7, MagicMock(spec=LLMClient))

    assert calls["failed"] == [(7, None)]


async def test_pipeline_failure_is_logged_not_raised(monkeypatch, caplog):
    async def failing_collect_context(session_id):
        raise RuntimeError("boom")

    async def fake_mark_failed(session_id, is_clothing_shortage=None):
        return None

    monkeypatch.setattr(pipeline, "collect_context", failing_collect_context)
    monkeypatch.setattr(pipeline, "mark_generation_failed", fake_mark_failed)

    await pipeline.run_recommendation_pipeline(7, MagicMock(spec=LLMClient))

    assert "recommend.pipeline.failed" in caplog.text


async def test_recommend_runs_real_loop_with_fake_llm(monkeypatch):
    # 프롬프트 조립·1차 검증·리뷰어·생성 루프를 실제 코드로 통과시키고 LLM만 가짜로 둔다
    supplement = SupplementResult(
        candidates=[
            _supplemented(1, "top"),
            _supplemented(2, "top"),
            _supplemented(3, "bottom"),
            _supplemented(4, "bottom"),
            _supplemented(5, "shoes", source_cd="essential"),
            _supplemented(6, "shoes", source_cd="essential"),
        ],
        is_clothing_shortage=False,
        outer_requirement="optional",
    )
    combos = [["o1", "o3", "e5"], ["o2", "o4", "e6"], ["o1", "o4", "e5"], ["o2", "o3", "e6"]]

    async def fake_collect(context, filter_result):
        return supplement

    async def fake_load(db, member_id, rng):
        return _preferences()

    async def fake_call(config, system, messages, output_model):
        if output_model is OutfitGenerationOutput:
            outfits = [{"outfit_type": "preferred", "item_ids": c, "reason": "r"} for c in combos]
            return OutfitGenerationOutput.model_validate({"outfits": outfits})
        seqs = [int(n) for n in re.findall(r"^세트 (\d+)$", messages[0]["content"], re.M)]
        reviews = [{"outfit_seq": seq, "reason": "ok", "pass": True} for seq in seqs]
        return OutfitReviewOutput.model_validate({"reviews": reviews})

    llm = MagicMock(spec=LLMClient)
    llm.call_structured = AsyncMock(side_effect=fake_call)
    monkeypatch.setattr(pipeline, "collect_essential_candidates", fake_collect)
    monkeypatch.setattr(pipeline, "load_preferences", fake_load)
    monkeypatch.setattr(pipeline, "AsyncSessionLocal", _fake_session)

    outcome = await pipeline.recommend(_context(), llm)

    generation = outcome.generation
    assert [list(o.item_keys) for o in generation.outfits] == combos
    assert generation.rounds == 1
    assert generation.fallback_count == 0
    assert llm.call_structured.await_count == 2
