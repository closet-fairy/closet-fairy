"""추천 세션 리포지토리 테스트."""

from datetime import datetime
from types import SimpleNamespace

import pytest

from app.repositories import recommendation_session as session_repo


class _Result:
    def __init__(self, rowcount, rows=()):
        self.rowcount = rowcount
        self._rows = rows

    def first(self):
        return self._rows[0] if self._rows else None

    def scalar_one(self):
        return next(iter(vars(self._rows[0]).values()))

    def __iter__(self):
        return iter(self._rows)


class _FakeDb:
    def __init__(self, rowcount=1, rows=()):
        self.executed = []
        self.committed = False
        self._rowcount = rowcount
        self._rows = [SimpleNamespace(**r) for r in rows]

    async def execute(self, statement, params=None):
        self.executed.append((str(statement), params))
        return _Result(self._rowcount, self._rows)

    async def commit(self):
        self.committed = True


@pytest.mark.parametrize(("rowcount", "expected"), [(1, True), (0, False)])
async def test_complete_generation_only_updates_processing(rowcount, expected):
    db = _FakeDb(rowcount)

    changed = await session_repo.complete_generation(db, 7, True)

    sql, params = db.executed[0]
    assert "generation_status_cd = 'completed'" in sql
    assert "AND generation_status_cd = 'processing'" in sql
    assert "AND session_status_cd = 'active'" in sql
    assert params == {"recommendation_session_id": 7, "is_clothing_shortage": True}
    assert changed is expected
    assert not db.committed


async def test_mark_generation_failed_without_shortage_keeps_flag():
    db = _FakeDb()

    changed = await session_repo.mark_generation_failed(db, 7)

    sql, params = db.executed[0]
    assert "generation_status_cd = 'failed'" in sql
    assert "AND generation_status_cd = 'processing'" in sql
    assert "is_clothing_shortage" not in sql
    assert params == {"recommendation_session_id": 7}
    assert changed is True
    assert not db.committed


async def test_mark_generation_failed_with_shortage_records_flag():
    db = _FakeDb(rowcount=0)

    changed = await session_repo.mark_generation_failed(db, 7, is_clothing_shortage=True)

    sql, params = db.executed[0]
    assert "is_clothing_shortage = :is_clothing_shortage" in sql
    assert "AND generation_status_cd = 'processing'" in sql
    assert params == {"recommendation_session_id": 7, "is_clothing_shortage": True}
    assert changed is False


async def test_lock_session_locks_row():
    db = _FakeDb(
        rows=[
            {
                "member_id": 1,
                "session_status_cd": "active",
                "generation_status_cd": "completed",
                "settled_at": None,
            }
        ]
    )

    row = await session_repo.lock_session(db, 7)

    sql, params = db.executed[0]
    assert "FOR UPDATE" in sql
    assert params == {"recommendation_session_id": 7}
    assert row == session_repo.LockedSessionRow(1, "active", "completed", None)


async def test_lock_session_returns_none_when_missing():
    assert await session_repo.lock_session(_FakeDb(), 7) is None


async def test_complete_settlement_only_updates_unsettled():
    db = _FakeDb(rowcount=0)
    settled_at = datetime(2026, 10, 9, 12, 30)

    changed = await session_repo.complete_settlement(db, 7, settled_at)

    sql, params = db.executed[0]
    assert "session_status_cd = 'completed'" in sql
    assert "ended_at = :settled_at" in sql
    assert "AND settled_at IS NULL" in sql
    assert params == {"recommendation_session_id": 7, "settled_at": settled_at}
    assert changed is False
    assert not db.committed


@pytest.mark.parametrize("status", ["canceled", "abandoned"])
async def test_end_session_only_ends_active_and_fails_processing_generation(status):
    db = _FakeDb(rowcount=1)
    ended_at = datetime(2026, 10, 9, 12, 30)

    changed = await session_repo.end_session(db, 7, status, ended_at)

    sql, params = db.executed[0]
    assert "session_status_cd = :session_status_cd, ended_at = :ended_at" in sql
    assert "WHEN generation_status_cd = 'processing'" in sql
    assert "THEN 'failed' ELSE generation_status_cd END" in sql
    assert "AND session_status_cd = 'active'" in sql
    assert "settled_at" not in sql
    assert params == {
        "recommendation_session_id": 7,
        "session_status_cd": status,
        "ended_at": ended_at,
    }
    assert changed is True
    assert not db.committed


async def test_end_session_returns_false_when_not_active():
    assert (
        await session_repo.end_session(_FakeDb(rowcount=0), 7, "canceled", datetime(2026, 10, 9))
        is False
    )


def test_inactive_search_and_single_check_share_one_activity_condition():
    condition = session_repo._HAS_ACTIVITY_SINCE
    assert condition in str(session_repo.HAS_ACTIVITY_SINCE_SQL)
    assert f"NOT {condition}" in str(session_repo.FIND_INACTIVE_SESSION_IDS_SQL)
    for table in ("s.created_at", "recommendation_deck d", "regeneration_request r"):
        assert table in condition


@pytest.mark.parametrize(("value", "expected"), [(1, True), (0, False)])
async def test_has_activity_since_returns_bool(value, expected):
    db = _FakeDb(rows=[{"has_activity": value}])
    since = datetime(2026, 10, 9, 12, 0)

    assert await session_repo.has_activity_since(db, 7, since) is expected
    assert db.executed[0][1] == {"recommendation_session_id": 7, "since": since}


async def test_find_inactive_session_ids_targets_old_active_sessions():
    db = _FakeDb(rows=[{"recommendation_session_id": 3}, {"recommendation_session_id": 9}])
    since = datetime(2026, 10, 9, 12, 0)

    ids = await session_repo.find_inactive_session_ids(db, since)

    sql, params = db.executed[0]
    assert "s.session_status_cd = 'active'" in sql
    assert "s.created_at < :since" in sql
    assert params == {"since": since}
    assert ids == [3, 9]


async def test_find_sessions_to_clean_looks_for_unrated_outfits_or_empty_decks():
    db = _FakeDb(rows=[{"recommendation_session_id": 4}])

    ids = await session_repo.find_sessions_to_clean(db)

    sql, _ = db.executed[0]
    assert "IN ('completed', 'canceled', 'abandoned')" in sql
    assert "LEFT JOIN outfit o" in sql
    assert "f.feedback_type_cd = 'rated'" in sql
    assert "f.outfit_feedback_id IS NULL" in sql
    assert ids == [4]
