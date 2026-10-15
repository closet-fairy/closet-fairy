"""재추천 요청 리포지토리 테스트."""

from datetime import datetime

import pytest

from app.repositories import regeneration_request as regeneration_repo

STALE_BEFORE = datetime(2026, 10, 14, 12, 27)


class _Result:
    def __init__(self, scalar=None, rowcount=0, lastrowid=0):
        self._scalar = scalar
        self.rowcount = rowcount
        self.lastrowid = lastrowid

    def scalar_one(self):
        return self._scalar


class _FakeDb:
    def __init__(self, scalar=None, rowcount=0, lastrowid=0):
        self.executed = []
        self.committed = False
        self._result = _Result(scalar, rowcount, lastrowid)

    async def execute(self, statement, params):
        self.executed.append((str(statement), params))
        return self._result

    async def commit(self):
        self.committed = True


@pytest.mark.parametrize(("scalar", "expected"), [(1, True), (0, False)])
async def test_has_processing_request_counts_only_fresh_processing(scalar, expected):
    db = _FakeDb(scalar=scalar)

    has_processing = await regeneration_repo.has_processing_request(db, 7, STALE_BEFORE)

    sql, params = db.executed[0]
    assert "regeneration_status_cd = 'processing'" in sql
    assert "created_at >= :stale_before" in sql
    assert params == {"recommendation_session_id": 7, "stale_before": STALE_BEFORE}
    assert has_processing is expected


async def test_fail_stale_processing_updates_only_old_processing():
    db = _FakeDb(rowcount=2)

    failed_count = await regeneration_repo.fail_stale_processing(db, 7, STALE_BEFORE)

    sql, params = db.executed[0]
    assert "SET regeneration_status_cd = 'failed'" in sql
    assert "AND regeneration_status_cd = 'processing'" in sql
    assert "AND created_at < :stale_before" in sql
    assert params == {"recommendation_session_id": 7, "stale_before": STALE_BEFORE}
    assert failed_count == 2
    assert not db.committed


async def test_next_request_seq_starts_from_one():
    db = _FakeDb(scalar=1)

    request_seq = await regeneration_repo.next_request_seq(db, 7)

    sql, params = db.executed[0]
    assert "COALESCE(MAX(request_seq), 0) + 1" in sql
    assert params == {"recommendation_session_id": 7}
    assert request_seq == 1


async def test_insert_request_returns_new_id_without_commit():
    db = _FakeDb(lastrowid=55)

    request_id = await regeneration_repo.insert_request(
        db,
        recommendation_session_id=7,
        request_seq=2,
        target_scope_cd="single",
        target_outfit_id=101,
        target_slot_cd="shoes",
        request_text="좀 더 캐주얼하게",
        parsed_intent='{"status": "ok"}',
    )

    sql, params = db.executed[0]
    assert "INSERT INTO regeneration_request" in sql
    assert "regeneration_status_cd" not in sql
    assert params == {
        "recommendation_session_id": 7,
        "request_seq": 2,
        "target_scope_cd": "single",
        "target_outfit_id": 101,
        "target_slot_cd": "shoes",
        "request_text": "좀 더 캐주얼하게",
        "parsed_intent": '{"status": "ok"}',
    }
    assert request_id == 55
    assert not db.committed
