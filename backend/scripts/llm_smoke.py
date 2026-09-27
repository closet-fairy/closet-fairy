"""LLM 래퍼 스모크 테스트. 실제 API를 1회 호출한다 (비용 발생).

backend/ 폴더에서 실행한다:
    python scripts/llm_smoke.py
.env의 ANTHROPIC_API_KEY가 필요하다.
"""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

from pydantic import BaseModel

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import get_settings  # noqa: E402
from app.core.logging import setup_logging  # noqa: E402
from app.llm import LLMCallConfig, create_llm_client  # noqa: E402


class SmokeAnswer(BaseModel):
    answer: str
    confidence: float


async def main() -> None:
    setup_logging()
    llm = create_llm_client(get_settings())
    try:
        result = await llm.call_structured(
            LLMCallConfig(call_name="smoke", prompt_version="smoke/v1", max_tokens=1024),
            system="Answer briefly. confidence is a number between 0 and 1.",
            messages=[{"role": "user", "content": "What is the capital of France?"}],
            output_model=SmokeAnswer,
        )
    finally:
        await llm.aclose()
    print(repr(result))


if __name__ == "__main__":
    asyncio.run(main())
