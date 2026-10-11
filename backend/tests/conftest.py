import os

# with TestClient(app)로 lifespan을 도는 테스트가 모델을 내려받거나,
# 떠 있는 개발 DB의 clothing_job 큐를 건드리지 않게 한다
os.environ["BG_REMOVAL_ENABLED"] = "false"
