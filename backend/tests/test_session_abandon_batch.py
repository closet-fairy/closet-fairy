"""이탈 판정·세션 정리 배치 테스트. DB와 서비스는 가짜로 바꿔 끼운다."""

from datetime import datetime

from app.services.session_cleanup import NOTHING_DELETED, CleanupResult
from app.services.weather.base_time import KST
from app.workers import session_abandon_batch as batch

FIXED_NOW = datetime(2026, 10, 9, 21, 30, tzinfo=KST)


class _FakeSession:
    opened = 0

    async def __aenter__(self):
        _FakeSession.opened += 1
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False


def _patch(monkeypatch, *, inactive=(3, 4, 5), to_clean=(8, 9), abandon=None, cleanup=None):
    calls = []
    abandon = abandon or {}
    cleanup = cleanup or {}
    _FakeSession.opened = 0

    async def find_inactive_session_ids(db, since):
        calls.append(("find_inactive", since))
        return list(inactive)

    async def find_sessions_to_clean(db):
        calls.append(("find_to_clean",))
        return list(to_clean)

    async def abandon_if_inactive(db, session_id, since, now):
        calls.append(("abandon", session_id, since, now))
        result = abandon.get(session_id, True)
        if isinstance(result, Exception):
            raise result
        return result

    async def cleanup_ended_session(db, session_id):
        calls.append(("cleanup", session_id))
        result = cleanup.get(session_id, CleanupResult(3, 1))
        if isinstance(result, Exception):
            raise result
        return result

    monkeypatch.setattr(batch, "AsyncSessionLocal", _FakeSession)
    monkeypatch.setattr(batch.session_repo, "find_inactive_session_ids", find_inactive_session_ids)
    monkeypatch.setattr(batch.session_repo, "find_sessions_to_clean", find_sessions_to_clean)
    monkeypatch.setattr(batch, "abandon_if_inactive", abandon_if_inactive)
    monkeypatch.setattr(batch, "cleanup_ended_session", cleanup_ended_session)
    return calls


async def test_abandons_inactive_sessions_then_cleans_leftovers(monkeypatch):
    calls = _patch(monkeypatch)

    result = await batch.run(FIXED_NOW)

    since = datetime(2026, 10, 9, 12, 0)
    assert calls == [
        ("find_inactive", since),
        ("abandon", 3, since, FIXED_NOW),
        ("abandon", 4, since, FIXED_NOW),
        ("abandon", 5, since, FIXED_NOW),
        ("find_to_clean",),
        ("cleanup", 8),
        ("cleanup", 9),
    ]
    assert result == {"abandoned": 3, "cleaned": 2, "failed": 0}


async def test_each_session_gets_its_own_db_session(monkeypatch):
    _patch(monkeypatch)

    await batch.run(FIXED_NOW)

    assert _FakeSession.opened == 2 + 3 + 2


async def test_timeout_comes_from_settings(monkeypatch):
    calls = _patch(monkeypatch, inactive=(), to_clean=())
    monkeypatch.setenv("SESSION_ABANDON_TIMEOUT_MINUTES", "90")
    batch.get_settings.cache_clear()
    try:
        await batch.run(FIXED_NOW)
    finally:
        batch.get_settings.cache_clear()

    assert calls[0] == ("find_inactive", datetime(2026, 10, 9, 11, 0))


async def test_skipped_and_failed_sessions_are_counted_separately(monkeypatch, caplog):
    _patch(
        monkeypatch,
        abandon={3: False, 4: RuntimeError("deadlock")},
        cleanup={8: NOTHING_DELETED, 9: RuntimeError("deadlock")},
    )

    result = await batch.run(FIXED_NOW)

    assert result == {"abandoned": 1, "cleaned": 0, "failed": 2}
    errors = [r for r in caplog.records if r.levelname == "ERROR"]
    assert [r.recommendation_session_id for r in errors] == [4, 9]
