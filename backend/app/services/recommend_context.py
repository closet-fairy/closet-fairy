"""추천 파이프라인 1단계: 컨텍스트 수집 (REC-07).

세션 생성 시 이미 정해진 지역·외출시간·계절을 가져오고, 실시간 날씨를
조회해 weather_snapshot에 저장하고, 개인 설정과 완료 상태 옷(스타일·
계절 태그 포함)을 모아 RecommendContext 하나로 묶는다.
"""

from dataclasses import dataclass
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories import clothing as clothing_repo
from app.repositories import member_setting as member_setting_repo
from app.repositories import recommendation_session as session_repo
from app.repositories import weather_snapshot as weather_snapshot_repo
from app.repositories.clothing import ClothingCandidate
from app.services.weather.base_time import KST
from app.services.weather.weather_service import WeatherResult, get_weather


@dataclass
class RecommendContext:
    recommendation_session_id: int
    member_id: int
    going_out_start_at: datetime  # KST
    going_out_end_at: datetime  # KST
    season_cd: str
    weather: WeatherResult
    birth_year: int | None
    temperature_sensitivity_cd: str | None
    gender_cd: str
    preferred_styles: list[str]
    clothing: list[ClothingCandidate]


def _to_kst(dt: datetime) -> datetime:
    """DB에 저장된 tzinfo 없는 UTC datetime을 KST로 변환한다."""
    return dt.replace(tzinfo=timezone.utc).astimezone(KST)


async def collect_context(db: AsyncSession, recommendation_session_id: int) -> RecommendContext:
    session = await session_repo.get_session(db, recommendation_session_id)
    if session is None:
        raise ValueError(f"recommendation_session not found: {recommendation_session_id}")

    going_out_start = _to_kst(session.going_out_start_at)
    going_out_end = _to_kst(session.going_out_end_at)
    now = datetime.now(KST)

    weather = await get_weather(
        session.sido_nm, session.sigungu_nm, going_out_start, going_out_end, now
    )
    await weather_snapshot_repo.insert_weather_snapshot(db, recommendation_session_id, weather)

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

    return RecommendContext(
        recommendation_session_id=recommendation_session_id,
        member_id=session.member_id,
        going_out_start_at=going_out_start,
        going_out_end_at=going_out_end,
        season_cd=session.season_cd,
        weather=weather,
        birth_year=birth_year,
        temperature_sensitivity_cd=temperature_sensitivity_cd,
        gender_cd=gender_cd,
        preferred_styles=preferred_styles,
        clothing=clothing,
    )
