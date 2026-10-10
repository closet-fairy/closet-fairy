"""세션 산출물 정리 테스트. DB는 가짜로 바꿔 끼운다."""

from datetime import datetime

import pytest

from app.repositories.recommendation_session import LockedSessionRow
from app.services import session_cleanup as cleanup
from app.services.session_cleanup import CleanupResult


class _FakeTransaction:
    def __init__(self, db):
        self._db = db

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        self._db.events.append("rollback" if exc_type else "commit")
        return False


class _FakeDb:
    def __init__(self):
        self.events = []

    def begin(self):
        return _FakeTransaction(self)


def _session(status: str) -> LockedSessionRow:
    settled_at = datetime(2026, 10, 9, 12, 0) if status == "completed" else None
    return LockedSessionRow(1, status, "completed", settled_at)


def _patch_repos(monkeypatch, *, session=None, rated_outfit_id=102, outfit_ids=(101, 102, 201)):
    calls = []

    async def lock_session(db, session_id):
        calls.append(("lock_session", session_id))
        return session

    async def find_rated_outfit_id(db, session_id):
        calls.append(("rated_outfit_id", session_id))
        return rated_outfit_id

    async def delete_outfits_except(db, session_id, keep_outfit_id):
        calls.append(("delete_outfits_except", session_id, keep_outfit_id))
        return 2

    async def delete_empty_decks(db, session_id):
        calls.append(("delete_empty_decks", session_id))
        return 1

    async def find_session_outfit_ids(db, session_id):
        calls.append(("outfit_ids", session_id))
        return list(outfit_ids)

    async def delete_session_decks(db, session_id):
        calls.append(("delete_session_decks", session_id))
        return 2

    monkeypatch.setattr(cleanup.session_repo, "lock_session", lock_session)
    monkeypatch.setattr(cleanup.feedback_repo, "find_rated_outfit_id", find_rated_outfit_id)
    monkeypatch.setattr(cleanup.deck_repo, "delete_outfits_except", delete_outfits_except)
    monkeypatch.setattr(cleanup.deck_repo, "delete_empty_decks", delete_empty_decks)
    monkeypatch.setattr(cleanup.deck_repo, "find_session_outfit_ids", find_session_outfit_ids)
    monkeypatch.setattr(cleanup.deck_repo, "delete_session_decks", delete_session_decks)
    return calls


async def test_completed_session_keeps_rated_outfit_then_drops_empty_decks(monkeypatch):
    calls = _patch_repos(monkeypatch)

    result = await cleanup.cleanup_locked_session(_FakeDb(), 7, "completed")

    assert calls == [
        ("rated_outfit_id", 7),
        ("delete_outfits_except", 7, 102),
        ("delete_empty_decks", 7),
    ]
    assert result == CleanupResult(deleted_outfit_count=2, deleted_deck_count=1)


async def test_completed_session_without_rating_is_left_untouched(monkeypatch, caplog):
    calls = _patch_repos(monkeypatch, rated_outfit_id=None)

    result = await cleanup.cleanup_locked_session(_FakeDb(), 7, "completed")

    assert calls == [("rated_outfit_id", 7)]
    assert result == cleanup.NOTHING_DELETED
    warning = next(r for r in caplog.records if r.levelname == "WARNING")
    assert warning.recommendation_session_id == 7


@pytest.mark.parametrize("status", ["canceled", "abandoned"])
async def test_canceled_or_abandoned_session_loses_every_deck(monkeypatch, status):
    calls = _patch_repos(monkeypatch)

    result = await cleanup.cleanup_locked_session(_FakeDb(), 7, status)

    assert calls == [("outfit_ids", 7), ("delete_session_decks", 7)]
    assert result == CleanupResult(deleted_outfit_count=3, deleted_deck_count=2)


async def test_active_session_is_not_cleaned(monkeypatch):
    calls = _patch_repos(monkeypatch)

    result = await cleanup.cleanup_locked_session(_FakeDb(), 7, "active")

    assert calls == []
    assert result == cleanup.NOTHING_DELETED


async def test_ended_session_is_locked_first_and_cleaned_in_own_transaction(monkeypatch, caplog):
    calls = _patch_repos(monkeypatch, session=_session("completed"))
    caplog.set_level("INFO")
    db = _FakeDb()

    result = await cleanup.cleanup_ended_session(db, 7)

    assert [c[0] for c in calls] == [
        "lock_session",
        "rated_outfit_id",
        "delete_outfits_except",
        "delete_empty_decks",
    ]
    assert db.events == ["commit"]
    assert result == CleanupResult(2, 1)
    record = next(r for r in caplog.records if getattr(r, "event", None) == "session.cleaned")
    assert record.recommendation_session_id == 7
    assert record.deleted_outfit_count == 2
    assert record.deleted_deck_count == 1


async def test_cleanup_uses_status_read_after_lock(monkeypatch):
    calls = _patch_repos(monkeypatch, session=_session("active"))

    result = await cleanup.cleanup_ended_session(_FakeDb(), 7)

    assert calls == [("lock_session", 7)]
    assert result == cleanup.NOTHING_DELETED


async def test_cleanup_of_missing_session_does_nothing(monkeypatch, caplog):
    calls = _patch_repos(monkeypatch, session=None)
    caplog.set_level("INFO")

    result = await cleanup.cleanup_ended_session(_FakeDb(), 7)

    assert calls == [("lock_session", 7)]
    assert result == cleanup.NOTHING_DELETED
    assert not [r for r in caplog.records if getattr(r, "event", None) == "session.cleaned"]
