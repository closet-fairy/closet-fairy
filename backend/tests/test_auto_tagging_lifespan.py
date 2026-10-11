from fastapi.testclient import TestClient

from app.core.config import get_settings
from app.main import app
from app.workers import auto_tagging_lifespan as lifespan_module
from app.workers import bg_removal_lifespan as bg_lifespan_module


def test_disabled_lifespan_skips_worker(monkeypatch):
    def fail(*args, **kwargs):
        raise AssertionError("워커를 만들면 안 된다")

    monkeypatch.setattr(lifespan_module, "AutoTaggingWorker", fail)

    with TestClient(app):
        assert not hasattr(app.state, "auto_tagging_worker")


def test_enabled_lifespan_runs_worker_and_hands_it_to_bg_removal(monkeypatch):
    events = []

    class FakeTagger:
        def __init__(self, llm, model, image_max_side):
            events.append(("tagger", llm is app.state.llm_client, model, image_max_side))

    class FakeTaggingWorker:
        def __init__(
            self, tagger, storage, session_factory, concurrency, poll_interval_s, timeout_s
        ):
            events.append(("worker", concurrency, poll_interval_s, timeout_s))

        async def start(self):
            events.append("start")

        async def stop(self):
            events.append("stop")

    class FakeRemover:
        def __init__(self, *args):
            pass

        def warmup(self):
            pass

    class FakeBgWorker:
        def __init__(self, *args, tagging_worker, **kwargs):
            events.append(("bg", tagging_worker is app.state.auto_tagging_worker))

        async def start(self):
            pass

        async def stop(self):
            events.append("bg_stop")

    monkeypatch.setattr(get_settings(), "AUTO_TAGGING_ENABLED", True)
    monkeypatch.setattr(get_settings(), "BG_REMOVAL_ENABLED", True)
    monkeypatch.setattr(lifespan_module, "ClothingTagger", FakeTagger)
    monkeypatch.setattr(lifespan_module, "AutoTaggingWorker", FakeTaggingWorker)
    monkeypatch.setattr(bg_lifespan_module, "BackgroundRemover", FakeRemover)
    monkeypatch.setattr(bg_lifespan_module, "BgRemovalWorker", FakeBgWorker)

    with TestClient(app):
        assert isinstance(app.state.auto_tagging_worker, FakeTaggingWorker)

    assert events == [
        ("tagger", True, "claude-haiku-4-5", 1024),
        ("worker", 2, 2.0, 60.0),
        "start",
        ("bg", True),
        "bg_stop",
        "stop",
    ]
    assert not hasattr(app.state, "auto_tagging_worker")
