from __future__ import annotations

from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.services.llm import LLMClient, create_llm_client, get_llm_client, llm_lifespan


def test_create_llm_client_disables_sdk_retries():
    llm = create_llm_client(Settings(_env_file=None, ANTHROPIC_API_KEY="test-key"))

    assert isinstance(llm, LLMClient)
    assert llm._client.max_retries == 0
    assert llm._client.api_key == "test-key"


def test_lifespan_provides_single_client_and_closes_it():
    app = FastAPI(lifespan=llm_lifespan)
    seen: list[LLMClient] = []

    @app.get("/llm")
    def use_llm(llm: LLMClient = Depends(get_llm_client)) -> dict[str, bool]:
        seen.append(llm)
        return {"ok": True}

    with TestClient(app) as client:
        client.get("/llm")
        client.get("/llm")
        created = app.state.llm_client

    assert seen == [created, created]
    assert created._client.is_closed()
