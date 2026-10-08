"""추천 세션 리포지토리 테스트."""

import pytest

from app.repositories import recommendation_session as session_repo


class _Result:
    def __init__(self, rowcount):
        self.rowcount = rowcount


class _FakeDb:
    def __init__(self, rowcount=1):
        self.executed = []
        self.committed = False
        self._rowcount = rowcount

    async def execute(self, statement, params):
        self.executed.append((str(statement), params))
        return _Result(self._rowcount)

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
