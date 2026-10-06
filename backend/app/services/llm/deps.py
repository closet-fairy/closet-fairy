from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from anthropic import AsyncAnthropic
from fastapi import FastAPI, Request

from app.core.config import Settings, get_settings
from app.services.llm.client import LLMClient


def create_llm_client(settings: Settings) -> LLMClient:
    client = AsyncAnthropic(
        # 비어 있으면 None을 넘겨 SDK가 환경 변수에서 찾게 한다
        api_key=settings.ANTHROPIC_API_KEY or None,
        max_retries=0,  # 재시도는 LLMClient 한 곳에서만 한다
    )
    return LLMClient(client, settings)


@asynccontextmanager
async def llm_lifespan(app: FastAPI) -> AsyncIterator[None]:
    llm = create_llm_client(get_settings())
    app.state.llm_client = llm
    try:
        yield
    finally:
        await llm.aclose()


def get_llm_client(request: Request) -> LLMClient:
    return request.app.state.llm_client
