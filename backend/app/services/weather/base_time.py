"""기상청 발표 시각 계산.

기상청은 정해진 시각에만 발표하고, 발표 직후에는 아직 조회가 안 된다.
그래서 '지금 조회 가능한 가장 최근 발표 시각'을 계산해서 요청해야 한다.
"""
from datetime import datetime, timedelta, timezone

# 한국은 서머타임이 없어서 +9 고정으로 충분하다.
# (ZoneInfo("Asia/Seoul")은 Windows에서 tzdata 패키지가 없으면 에러가 난다)
KST = timezone(timedelta(hours=9))

# 초단기실황: 매시 정시 발표, 40분 이후 조회 가능 (여유 있게 40분 기준)
NCST_AVAILABLE_MINUTE = 40

# 단기예보: 하루 8번 발표, 발표 10분 뒤부터 조회 가능
VILAGE_BASE_HOURS = (2, 5, 8, 11, 14, 17, 20, 23)
VILAGE_AVAILABLE_MINUTE = 10


def ultra_srt_ncst_base(now: datetime) -> tuple[str, str]:
    """초단기실황 base_date, base_time. 예) 14:39 → 13:00, 14:40 → 14:00"""
    now = now.astimezone(KST)
    base = now if now.minute >= NCST_AVAILABLE_MINUTE else now - timedelta(hours=1)
    return base.strftime("%Y%m%d"), base.strftime("%H00")


def vilage_fcst_base(now: datetime) -> tuple[str, str]:
    """단기예보 base_date, base_time. 예) 14:09 → 11:00, 14:10 → 14:00, 02:05 → 전날 23:00"""
    now = now.astimezone(KST)
    for hour in reversed(VILAGE_BASE_HOURS):
        available_at = now.replace(
            hour=hour, minute=VILAGE_AVAILABLE_MINUTE, second=0, microsecond=0
        )
        if now >= available_at:
            return now.strftime("%Y%m%d"), f"{hour:02d}00"
    yesterday = now - timedelta(days=1)
    return yesterday.strftime("%Y%m%d"), "2300"
