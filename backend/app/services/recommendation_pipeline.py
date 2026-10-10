"""추천 파이프라인.

컨텍스트 수집(REC-07) → 룰 전처리(REC-08) → 에센셜 보충(REC-09) → 선호도·탐색 스타일(REC-10)
→ 생성 입력 조립 → 생성 루프(REC-15, 1차·2차 검증과 폴백 포함) → 결과 저장(REC-16) 순서로 잇는다.
"""

import logging
import random
from dataclasses import dataclass

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.db import AsyncSessionLocal
from app.core.logging import Event
from app.repositories import preference_score as preference_repo
from app.services.essential_supplement import (
    SupplementedCandidate,
    SupplementResult,
    collect_essential_candidates,
)
from app.services.llm import LLMClient
from app.services.outfit_generator import (
    MAX_OUTFITS,
    GenerationResult,
    generate_outfits,
    make_basic_outfit_fallback,
    make_hard_rule_check,
    make_llm_reviewer,
)
from app.services.preference_score import (
    ClassificationResult,
    classify,
    select_exploration_style,
)
from app.services.prompt.outfit_generation import (
    CandidateItem,
    HourlyForecast,
    OutfitPromptInput,
    WeatherInput,
)
from app.services.recommend_context import RecommendContext, collect_context
from app.services.recommendation_save import (
    GenerationNotProcessingError,
    mark_generation_failed,
    save_recommendation_result,
)
from app.services.rule_filter import filter_clothing
from app.services.weather.weather_service import WeatherResult

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class Preferences:
    style_result: ClassificationResult
    color_result: ClassificationResult
    exploration_style: str | None


@dataclass(frozen=True)
class RecommendOutcome:
    generation: GenerationResult
    supplement: SupplementResult
    prompt_input: OutfitPromptInput
    owned_count: int
    filtered_owned_count: int


async def run_recommendation_pipeline(recommendation_session_id: int, llm: LLMClient) -> None:
    try:
        context = await collect_context(recommendation_session_id)
        outcome = await recommend(context, llm)
        if not outcome.generation.outfits:
            logger.warning("recommend.pipeline.empty session_id=%s", recommendation_session_id)
            await mark_generation_failed(
                recommendation_session_id, outcome.supplement.is_clothing_shortage
            )
            return
        await save_recommendation_result(
            recommendation_session_id,
            context.member_id,
            outcome.generation.outfits,
            outcome.supplement,
        )
    except GenerationNotProcessingError:
        # 취소·이탈로 끝난 세션. failed는 end_session이 이미 기록했다
        logger.warning("recommend.pipeline.discarded session_id=%s", recommendation_session_id)
        return
    except Exception:
        logger.exception("recommend.pipeline.failed session_id=%s", recommendation_session_id)
        await mark_generation_failed(recommendation_session_id)
        return
    logger.info(
        "recommend.pipeline.saved session_id=%s outfits=%d fallback=%d rounds=%d",
        recommendation_session_id,
        len(outcome.generation.outfits),
        outcome.generation.fallback_count,
        outcome.generation.rounds,
    )


async def recommend(
    context: RecommendContext, llm: LLMClient, *, rng: random.Random | None = None
) -> RecommendOutcome:
    """컨텍스트 하나로 코디를 만든다. 저장은 하지 않는다 (시나리오 스크립트도 이 함수를 쓴다)."""
    filter_result = filter_clothing(context)
    supplement = await collect_essential_candidates(context, filter_result)
    logger.info(
        "recommend candidates",
        extra={
            "event": Event.RECOMMEND_CANDIDATES,
            "recommendation_session_id": context.recommendation_session_id,
            "owned_count": len(context.clothing),
            "filtered_owned_count": len(filter_result.candidates),
            "candidate_count": len(supplement.candidates),
        },
    )
    async with AsyncSessionLocal() as db:
        preferences = await load_preferences(db, context.member_id, rng or random.Random())

    prompt_input = build_prompt_input(context, supplement, preferences)
    generation = await generate_outfits(
        llm,
        prompt_input,
        hard_rule=make_hard_rule_check(prompt_input),
        review=make_llm_reviewer(llm, prompt_input),
        fallback=make_basic_outfit_fallback(
            prompt_input.candidates, prompt_input.is_outer_required
        ),
        session_id=context.recommendation_session_id,
    )
    return RecommendOutcome(
        generation=generation,
        supplement=supplement,
        prompt_input=prompt_input,
        owned_count=len(context.clothing),
        filtered_owned_count=len(filter_result.candidates),
    )


async def load_preferences(db: AsyncSession, member_id: int, rng: random.Random) -> Preferences:
    settings = get_settings()
    rows = await preference_repo.find_preference_scores(db, member_id)
    style_result = classify("style", rows["style"], settings)
    color_result = classify("color", rows["color"], settings)
    if not style_result.preference_injected:
        return Preferences(style_result, color_result, exploration_style=None)
    n_sessions = await preference_repo.count_settled_sessions(db, member_id)
    exploration_style = select_exploration_style(
        style_result, rows["style"], n_sessions, settings, rng
    )
    return Preferences(style_result, color_result, exploration_style)


def build_prompt_input(
    context: RecommendContext,
    supplement: SupplementResult,
    preferences: Preferences,
    outfit_count: int = MAX_OUTFITS,
) -> OutfitPromptInput:
    return OutfitPromptInput(
        weather=to_weather_input(context.weather),
        going_out_start_at=context.going_out_start_at,
        going_out_end_at=context.going_out_end_at,
        season_cd=context.season_cd,
        tpo_cd=context.tpo_cd,
        tpo_text=context.tpo_text,
        temperature_sensitivity_cd=context.temperature_sensitivity_cd,
        birth_year=context.birth_year,
        gender_cd=context.gender_cd,
        style_result=preferences.style_result,
        color_result=preferences.color_result,
        exploration_style=preferences.exploration_style,
        is_outer_required=supplement.outer_requirement == "required",
        candidates=[to_candidate_item(c) for c in supplement.candidates],
        outfit_count=outfit_count,
    )


def to_candidate_item(candidate: SupplementedCandidate) -> CandidateItem:
    return CandidateItem(
        source=candidate.source_cd,
        item_id=candidate.item_id,
        category_cd=candidate.category_cd,
        item_name=candidate.item_name,
        color_cd=candidate.color_cd,
        style_cds=list(candidate.styles),
        thickness_cd=candidate.thickness_cd,
        accessory_type_cd=candidate.accessory_type_cd,
        seasons=list(candidate.seasons),
    )


def to_weather_input(weather: WeatherResult) -> WeatherInput:
    return WeatherInput(
        temperature=weather.temperature,
        feels_like_temperature=weather.feels_like_temperature,
        precipitation=weather.precipitation,
        wind_speed=weather.wind_speed,
        weather_condition_cd=weather.weather_condition_cd,
        min_feels_like_temperature=weather.min_feels_like_temperature,
        is_fallback=weather.is_fallback,
        hourly=[
            HourlyForecast(
                at=h.at,
                temperature=h.temperature,
                feels_like_temperature=h.feels_like_temperature,
                precipitation=h.precipitation,
                weather_condition_cd=h.weather_condition_cd,
            )
            for h in weather.hourly
        ],
    )
