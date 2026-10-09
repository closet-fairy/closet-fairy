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


class _FakeDb:
    def __init__(self, rowcount=1, rows=()):
        self.executed = []
        self.committed = False
        self._rowcount = rowcount
        self._rows = [SimpleNamespace(**r) for r in rows]

    async def execute(self, statement, params):
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


async def test_lock_session_for_rating_locks_row():
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

    row = await session_repo.lock_session_for_rating(db, 7)

    sql, params = db.executed[0]
    assert "FOR UPDATE" in sql
    assert params == {"recommendation_session_id": 7}
    assert row == session_repo.RatingSessionRow(1, "active", "completed", None)


async def test_lock_session_for_rating_returns_none_when_missing():
    assert await session_repo.lock_session_for_rating(_FakeDb(), 7) is None


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
