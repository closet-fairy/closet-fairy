import os

import pytest

# with TestClient(app)로 lifespan을 도는 테스트가 모델을 내려받거나,
# 떠 있는 개발 DB의 clothing_job 큐를 건드리지 않게 한다
os.environ["BG_REMOVAL_ENABLED"] = "false"
os.environ["AUTO_TAGGING_ENABLED"] = "false"


@pytest.fixture(autouse=True)
def _fresh_clothing_rate_limiter():
    from app.services.clothing_rate_limit import get_clothing_rate_limiter

    get_clothing_rate_limiter.cache_clear()
    yield
    get_clothing_rate_limiter.cache_clear()
