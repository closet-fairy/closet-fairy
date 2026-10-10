from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.main import app
from app.workers import bg_removal_lifespan as lifespan_module


def test_disabled_lifespan_skips_model_and_worker(monkeypatch):
    def fail(*args, **kwargs):
        raise AssertionError("모델을 로드하면 안 된다")

    monkeypatch.setattr(lifespan_module, "BackgroundRemover", fail)

    with TestClient(app):
        assert not hasattr(app.state, "bg_removal_worker")


def test_enabled_lifespan_loads_model_and_runs_worker_until_shutdown(monkeypatch):
    events = []

    class FakeRemover:
        def __init__(self, model_name, post_process_mask):
            events.append(("load", model_name, post_process_mask))

        def warmup(self):
            events.append("warmup")

    class FakeWorker:
        def __init__(self, remover, storage, session_factory, concurrency, poll_interval_s):
            events.append(("worker", concurrency, poll_interval_s))

        async def start(self):
            events.append("start")

        async def stop(self):
            events.append("stop")

    monkeypatch.setattr(get_settings(), "BG_REMOVAL_ENABLED", True)
    monkeypatch.setattr(lifespan_module, "BackgroundRemover", FakeRemover)
    monkeypatch.setattr(lifespan_module, "BgRemovalWorker", FakeWorker)

    with TestClient(app):
        assert isinstance(app.state.bg_removal_worker, FakeWorker)
        assert "stop" not in events

    assert events == [
        ("load", "isnet-general-use", True),
        "warmup",
        ("worker", 1, 2.0),
        "start",
        "stop",
    ]
    assert not hasattr(app.state, "bg_removal_worker")
