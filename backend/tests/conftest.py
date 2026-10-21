import os

import pytest

# with TestClient(app)로 lifespan을 도는 테스트가 모델을 내려받거나,
# 떠 있는 개발 DB의 clothing_job 큐를 건드리지 않게 한다
os.environ["BG_REMOVAL_ENABLED"] = "false"
os.environ["AUTO_TAGGING_ENABLED"] = "false"


# 빈도 제한기는 프로세스에 하나라 테스트끼리 요청 수가 쌓여 429가 나지 않도록 매번 새로 만든다
@pytest.fixture(autouse=True)
def _fresh_clothing_rate_limiter():
    from app.services.clothing_rate_limit import get_clothing_rate_limiter

    get_clothing_rate_limiter.cache_clear()
    yield
    get_clothing_rate_limiter.cache_clear()


@pytest.fixture
def settings_env(monkeypatch):
    from app.core.config import get_settings

    def apply(**values):
        for key, value in values.items():
            monkeypatch.setenv(key, value)
        get_settings.cache_clear()

    yield apply
    get_settings.cache_clear()
