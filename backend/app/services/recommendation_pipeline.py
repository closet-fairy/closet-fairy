"""추천 파이프라인 진입점. 지금은 빈 함수 — 생성 루프(#28)가 끝나면 여기에 연결한다."""

import logging

logger = logging.getLogger(__name__)


async def run_recommendation_pipeline(recommendation_session_id: int) -> None:
    logger.info("recommend.pipeline.start session_id=%s (아직 미구현)", recommendation_session_id)
