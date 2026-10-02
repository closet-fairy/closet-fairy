"""추천 파이프라인 진입점. 지금은 컨텍스트 수집(REC-07)까지만 하고,
생성 루프(#28)가 생기면 그 뒤로 이어 붙인다."""

import logging

from app.core.db import AsyncSessionLocal
from app.services.recommend_context import collect_context

logger = logging.getLogger(__name__)


async def run_recommendation_pipeline(recommendation_session_id: int) -> None:
    async with AsyncSessionLocal() as db:
        context = await collect_context(db, recommendation_session_id)
    logger.info(
        "recommend.pipeline.context_collected session_id=%s clothing_count=%d (이후 단계 미구현)",
        recommendation_session_id,
        len(context.clothing),
    )
