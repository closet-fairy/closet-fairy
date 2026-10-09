"""세션 취소·이탈 테스트. DB는 가짜로 바꿔 끼운다."""

from datetime import datetime

import pytest

from app.repositories.recommendation_session import LockedSessionRow
from app.services import rating_settlement as settlement
from app.services import session_end
from app.services.session_cleanup import CleanupResult
from app.services.weather.base_time import KST

FIXED_NOW = datetime(2026, 10, 9, 21, 30, tzinfo=KST)
SINCE = datetime(2026, 10, 9, 12, 0)


class _FakeTransaction:
    def __init__(self, db):
        self._db = db

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        self._db.events.append("rollback" if exc_type else "commit")
        if exc_type is None and self._db.commit_error is not None:
            raise self._db.commit_error
        return False


class _FakeDb:
    def __init__(self, commit_error=None):
        self.events = []
        self.commit_error = commit_error

    def begin(self):
        return _FakeTransaction(self)


def _session(status="active", generation="completed", member_id=1, settled_at=None):
    return LockedSessionRow(member_id, status, generation, settled_at)


def _patch_repos(monkeypatch, *, session=None, has_activity=False):
    calls = []

    async def lock_session(db, session_id):
        calls.append(("lock_session", session_id))
        return session

    async def has_activity_since(db, session_id, since):
        calls.append(("has_activity", session_id, since))
        return has_activity

    async def end_session(db, session_id, status_cd, ended_at):
        calls.append(("end_session", session_id, status_cd, ended_at))
        return True

    async def cleanup_locked_session(db, session_id, status_cd):
        calls.append(("cleanup", session_id, status_cd))
        return CleanupResult(deleted_outfit_count=4, deleted_deck_count=1)

    monkeypatch.setattr(session_end.session_repo, "lock_session", lock_session)
    monkeypatch.setattr(session_end.session_repo, "has_activity_since", has_activity_since)
    monkeypatch.setattr(session_end.session_repo, "end_session", end_session)
    monkeypatch.setattr(session_end, "cleanup_locked_session", cleanup_locked_session)
    return calls


# ---------- 취소 ----------


@pytest.mark.parametrize("generation", ["processing", "completed", "failed"])
async def test_cancel_ends_session_and_deletes_decks_in_one_transaction(monkeypatch, generation):
    calls = _patch_repos(monkeypatch, session=_session(generation=generation))
    db = _FakeDb()

    status = await session_end.cancel_session(db, 7, 1, FIXED_NOW)

    assert status == "canceled"
    assert calls == [
        ("lock_session", 7),
        ("end_session", 7, "canceled", datetime(2026, 10, 9, 12, 30)),
        ("cleanup", 7, "canceled"),
    ]
    assert db.events == ["commit"]


async def test_cancel_logs_after_commit_with_counts_only(monkeypatch, caplog):
    _patch_repos(monkeypatch, session=_session())
    caplog.set_level("INFO")

    await session_end.cancel_session(_FakeDb(), 7, 1, FIXED_NOW)

    record = next(r for r in caplog.records if getattr(r, "event", None) == "session.canceled")
    assert record.recommendation_session_id == 7
    assert record.deleted_deck_count == 1


async def test_cancel_is_not_logged_when_commit_fails(monkeypatch, caplog):
    _patch_repos(monkeypatch, session=_session())
    caplog.set_level("INFO")

    with pytest.raises(RuntimeError):
        await session_end.cancel_session(_FakeDb(RuntimeError("commit failed")), 7, 1, FIXED_NOW)

    assert not [r for r in caplog.records if getattr(r, "event", None) == "session.canceled"]


@pytest.mark.parametrize("status", ["canceled", "abandoned"])
async def test_cancel_of_already_ended_session_returns_its_status(monkeypatch, status):
    calls = _patch_repos(monkeypatch, session=_session(status=status))

    assert await session_end.cancel_session(_FakeDb(), 7, 1, FIXED_NOW) == status
    assert calls == [("lock_session", 7)]


async def test_cancel_of_settled_session_is_409(monkeypatch):
    settled = _session(status="completed", settled_at=datetime(2026, 10, 9, 12, 0))
    calls = _patch_repos(monkeypatch, session=settled)
    db = _FakeDb()

    with pytest.raises(settlement.SessionAlreadySettledError):
        await session_end.cancel_session(db, 7, 1, FIXED_NOW)

    assert calls == [("lock_session", 7)]
    assert db.events == ["rollback"]


@pytest.mark.parametrize("session", [None, _session(member_id=2)], ids=["missing", "other-member"])
async def test_cancel_of_missing_or_other_members_session_is_404(monkeypatch, session):
    calls = _patch_repos(monkeypatch, session=session)

    with pytest.raises(settlement.SessionNotFoundError):
        await session_end.cancel_session(_FakeDb(), 7, 1, FIXED_NOW)

    assert calls == [("lock_session", 7)]


# ---------- 이탈 ----------


async def test_inactive_session_is_abandoned_after_recheck_under_lock(monkeypatch, caplog):
    calls = _patch_repos(monkeypatch, session=_session(generation="processing"))
    caplog.set_level("INFO")
    db = _FakeDb()

    abandoned = await session_end.abandon_if_inactive(db, 7, SINCE, FIXED_NOW)

    assert abandoned is True
    assert calls == [
        ("lock_session", 7),
        ("has_activity", 7, SINCE),
        ("end_session", 7, "abandoned", datetime(2026, 10, 9, 12, 30)),
        ("cleanup", 7, "abandoned"),
    ]
    assert db.events == ["commit"]
    record = next(r for r in caplog.records if getattr(r, "event", None) == "session.abandoned")
    assert record.recommendation_session_id == 7
    assert record.deleted_deck_count == 1


@pytest.mark.parametrize("status", ["completed", "canceled", "abandoned"])
async def test_session_that_ended_meanwhile_is_skipped(monkeypatch, status):
    calls = _patch_repos(monkeypatch, session=_session(status=status))

    assert await session_end.abandon_if_inactive(_FakeDb(), 7, SINCE, FIXED_NOW) is False
    assert calls == [("lock_session", 7)]


async def test_session_with_new_activity_is_skipped(monkeypatch):
    calls = _patch_repos(monkeypatch, session=_session(), has_activity=True)

    assert await session_end.abandon_if_inactive(_FakeDb(), 7, SINCE, FIXED_NOW) is False
    assert [c[0] for c in calls] == ["lock_session", "has_activity"]


async def test_missing_session_is_skipped(monkeypatch):
    calls = _patch_repos(monkeypatch, session=None)

    assert await session_end.abandon_if_inactive(_FakeDb(), 7, SINCE, FIXED_NOW) is False
    assert calls == [("lock_session", 7)]
