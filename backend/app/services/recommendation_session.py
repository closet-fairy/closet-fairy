"""추천 요청 → 세션 생성."""
from datetime import datetime, timedelta, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ValidationError
from app.repositories import recommendation_session as session_repo
from app.schemas.recommendation_session import RecommendationSessionCreate
from app.services.weather.base_time import KST
from app.services.weather.regions import find_region


class PastGoingOutTimeError(ValidationError):
    code = "PAST_GOING_OUT_TIME"
    message = "외출 시작 시각이 이미 지났습니다."


def resolve_going_out_period(
    req: RecommendationSessionCreate, now: datetime
) -> tuple[datetime, datetime]:
    """'오늘' 기준 시각(KST)으로 바꾼다. 종료가 시작보다 이르면 종료만 다음 날.
    지금이 14:10이면 14:00 슬롯까지는 허용, 13:30은 거부."""
    now = now.astimezone(KST)
    today = now.date()
    start = datetime.combine(today, req.going_out_start_time, tzinfo=KST)
    end = datetime.combine(today, req.going_out_end_time, tzinfo=KST)
    if end < start:
        end += timedelta(days=1)

    current_slot = now.replace(minute=0 if now.minute < 30 else 30, second=0, microsecond=0)
    if start < current_slot:
        raise PastGoingOutTimeError()
    return start, end


def to_db_utc(dt: datetime) -> datetime:
    """DB는 UTC + tzinfo 없는 DATETIME으로 저장한다 (컨벤션)."""
    return dt.astimezone(timezone.utc).replace(tzinfo=None)


def season_by_month(now: datetime) -> str:
    """임시 계절 판정. #17(기온 추세 판정) 완료 후 교체한다."""
    month = now.astimezone(KST).month
    if month in (3, 4, 5):
        return "spring"
    if month in (6, 7, 8):
        return "summer"
    if month in (9, 10, 11):
        return "fall"
    return "winter"


async def create_session(
    db: AsyncSession, member_id: int, req: RecommendationSessionCreate, now: datetime
) -> int:
    find_region(req.sido_nm, req.sigungu_nm)  # 지원하지 않는 지역이면 404
    start, end = resolve_going_out_period(req, now)
    return await session_repo.insert_session(
        db,
        member_id=member_id,
        sido_nm=req.sido_nm,
        sigungu_nm=req.sigungu_nm,
        location_input_type_cd=req.location_input_type_cd,
        tpo_cd=req.tpo_cd,
        tpo_text=req.tpo_text,
        tpo_input_type_cd=req.tpo_input_type_cd,
        going_out_start_at=to_db_utc(start),
        going_out_end_at=to_db_utc(end),
        season_cd=season_by_month(now),
    )
