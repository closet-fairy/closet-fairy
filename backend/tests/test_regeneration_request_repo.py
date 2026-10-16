"""재추천 요청 리포지토리 테스트."""

from datetime import datetime

import pytest

from app.repositories import regeneration_request as regeneration_repo
from app.services.regeneration_intent import RegenerationIntent

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


class _Row:
    def __init__(self, **kwargs):
        self.__dict__.update(kwargs)


class _RowsResult:
    def __init__(self, rows):
        self._rows = rows

    def first(self):
        return self._rows[0] if self._rows else None

    def __iter__(self):
        return iter(self._rows)


class _RowsDb:
    def __init__(self, rows):
        self.executed = []
        self._rows = rows

    async def execute(self, statement, params):
        self.executed.append((str(statement), params))
        return _RowsResult(self._rows)


CASUAL_INTENT = '{"status": "ok", "preferred_styles": ["casual"]}'


async def test_get_request_restores_parsed_intent():
    db = _RowsDb(
        [
            _Row(
                regeneration_request_id=55,
                recommendation_session_id=7,
                request_seq=2,
                target_scope_cd="single",
                target_outfit_id=101,
                target_slot_cd="bottom",
                parsed_intent=CASUAL_INTENT,
                regeneration_status_cd="processing",
            )
        ]
    )

    row = await regeneration_repo.get_request(db, 55)

    sql, params = db.executed[0]
    assert "WHERE regeneration_request_id = :regeneration_request_id" in sql
    assert params == {"regeneration_request_id": 55}
    assert row.request_seq == 2
    assert row.target_slot_cd == "bottom"
    assert row.parsed_intent == RegenerationIntent(status="ok", preferred_styles=("casual",))


async def test_get_request_returns_none_when_missing():
    assert await regeneration_repo.get_request(_RowsDb([]), 55) is None


async def test_find_completed_intents_reads_only_earlier_completed_in_order():
    db = _RowsDb(
        [
            _Row(parsed_intent=CASUAL_INTENT),
            _Row(parsed_intent={"status": "ok", "clothing_warmth": "lighter"}),
        ]
    )

    intents = await regeneration_repo.find_completed_intents(db, 7, before_seq=3)

    sql, params = db.executed[0]
    assert "AND request_seq < :before_seq" in sql
    assert "AND regeneration_status_cd = 'completed'" in sql
    assert "ORDER BY request_seq" in sql
    assert params == {"recommendation_session_id": 7, "before_seq": 3}
    assert intents == [
        RegenerationIntent(status="ok", preferred_styles=("casual",)),
        RegenerationIntent(status="ok", clothing_warmth="lighter"),
    ]
