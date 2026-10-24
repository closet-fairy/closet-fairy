"""추천 파이프라인 1단계: 컨텍스트 수집 (REC-07).

세션 생성 시 이미 정해진 지역·외출시간·계절을 가져오고, 실시간 날씨를
조회해 weather_snapshot에 저장하고, 개인 설정과 완료 상태 옷(스타일·
계절 태그 포함)을 모아 RecommendContext 하나로 묶는다.
"""

from dataclasses import dataclass
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import AsyncSessionLocal
from app.repositories import clothing as clothing_repo
from app.repositories import member_setting as member_setting_repo
from app.repositories import recommendation_session as session_repo
from app.repositories import weather_snapshot as weather_snapshot_repo
from app.repositories.clothing import ClothingCandidate
from app.repositories.recommendation_session import SessionRow
from app.services.recommendation_session import to_db_utc
from app.services.weather.base_time import KST
from app.services.weather.weather_service import WeatherResult, get_weather, going_out_hours


@dataclass
class RecommendContext:
    recommendation_session_id: int
    member_id: int
    going_out_start_at: datetime  # KST
    going_out_end_at: datetime  # KST
    season_cd: str
    tpo_cd: str
    tpo_text: str | None
    tpo_input_type_cd: str
    weather: WeatherResult
    birth_year: int | None
    temperature_sensitivity_cd: str | None
    gender_cd: str
    preferred_styles: list[str]
    clothing: list[ClothingCandidate]
    is_going_out_tomorrow: bool = False
    ignores_current_weather: bool = False


def _to_kst(dt: datetime) -> datetime:
    """DB에 저장된 tzinfo 없는 UTC datetime을 KST로 변환한다."""
    return dt.replace(tzinfo=timezone.utc).astimezone(KST)


async def collect_context(recommendation_session_id: int) -> RecommendContext:
    async with AsyncSessionLocal() as db:
        session = await session_repo.get_session(db, recommendation_session_id)
    if session is None:
        raise ValueError(f"recommendation_session not found: {recommendation_session_id}")

    going_out_start = _to_kst(session.going_out_start_at)
    going_out_end = _to_kst(session.going_out_end_at)
    now = datetime.now(KST)

    # DB 세션을 쥐지 않은 상태에서 기상청 응답을 기다린다 (커넥션 점유 방지).
    weather = await get_weather(
        session.sido_nm, session.sigungu_nm, going_out_start, going_out_end, now
    )

    async with AsyncSessionLocal() as db:
        await weather_snapshot_repo.insert_weather_snapshot(
            db, recommendation_session_id, weather, to_db_utc(now.replace(microsecond=0))
        )
        return await load_context(db, recommendation_session_id, session, weather, now)


async def load_context(
    db: AsyncSession,
    recommendation_session_id: int,
    session: SessionRow,
    weather: WeatherResult,
    weather_observed_at: datetime,
) -> RecommendContext:
    setting = await member_setting_repo.get_member_setting(db, session.member_id)
    if setting is None:
        birth_year = None
        temperature_sensitivity_cd = None
        gender_cd = "unisex"
        preferred_styles: list[str] = []
    else:
        birth_year = setting.birth_year
        temperature_sensitivity_cd = setting.temperature_sensitivity_cd
        gender_cd = setting.gender_cd
        preferred_styles = await member_setting_repo.get_preferred_styles(
            db, setting.member_setting_id
        )

    clothing = await clothing_repo.get_completed_clothing(db, session.member_id)
    going_out_start = _to_kst(session.going_out_start_at)
    going_out_end = _to_kst(session.going_out_end_at)
    # 세션 생성 시각이 아니라 날씨 조회 시각과 비교한다. [날씨]가 외출 당일 값인지가 기준이라서
    is_going_out_tomorrow = going_out_start.date() > weather_observed_at.astimezone(KST).date()

    return RecommendContext(
        recommendation_session_id=recommendation_session_id,
        member_id=session.member_id,
        going_out_start_at=going_out_start,
        going_out_end_at=going_out_end,
        season_cd=session.season_cd,
        tpo_cd=session.tpo_cd,
        tpo_text=session.tpo_text,
        tpo_input_type_cd=session.tpo_input_type_cd,
        weather=weather,
        birth_year=birth_year,
        temperature_sensitivity_cd=temperature_sensitivity_cd,
        gender_cd=gender_cd,
        preferred_styles=preferred_styles,
        clothing=clothing,
        is_going_out_tomorrow=is_going_out_tomorrow,
        # 외출 시간대 예보가 없으면 지금 날씨까지 빼면 볼 날씨가 없으므로
        # 오늘 외출처럼 지금 날씨를 쓴다.
        # 대체값(is_fallback)은 지금 날씨가 아니라 평년값이라 내일에도 맞으므로 빼지 않는다.
        ignores_current_weather=is_going_out_tomorrow
        and not weather.is_fallback
        and bool(going_out_hours(weather.hourly, going_out_start, going_out_end)),
    )
