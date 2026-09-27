"""라우터 공통 의존성. 테스트에서 app.dependency_overrides로 바꿔 끼울 수 있다."""
from datetime import datetime

from app.core.config import get_settings
from app.services.weather.base_time import KST


def get_current_member_id() -> int:
    """인증이 붙기 전까지는 개발용 고정 회원. 인증 작업 때 이 함수만 교체하면 된다."""
    return get_settings().DEV_MEMBER_ID


def get_now() -> datetime:
    """현재 시각(KST). 테스트에서 시각을 고정하려고 함수로 뺐다."""
    return datetime.now(KST)
