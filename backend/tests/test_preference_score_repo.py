"""선호 점수 리포지토리 테스트 (정산용 잠금 · 갱신)."""

from decimal import Decimal
from types import SimpleNamespace

from app.repositories import preference_score as score_repo
from app.repositories.preference_score import ScoreUpdate


class _Result:
    def __init__(self, rows):
        self._rows = rows

    def __iter__(self):
        return iter(self._rows)


class _FakeDb:
    def __init__(self, rows=()):
        self.executed = []
        self._rows = [SimpleNamespace(**r) for r in rows]

    async def execute(self, statement, params):
        self.executed.append((str(statement), params))
        return _Result(self._rows)


async def test_lock_member_scores_locks_in_pk_order():
    db = _FakeDb(
        [
            {
                "preference_score_id": 1,
                "attribute_type_cd": "style",
                "attribute_value": "minimal",
                "score_sum": Decimal("2.0000"),
                "exposure_count": Decimal("1.0000"),
            }
        ]
    )

    rows = await score_repo.lock_member_scores(db, 3)

    sql, params = db.executed[0]
    assert "ORDER BY preference_score_id" in sql
    assert "FOR UPDATE" in sql
    assert params == {"member_id": 3}
    assert rows == [score_repo.ScoreRow(1, "style", "minimal", Decimal("2"), Decimal("1"))]


async def test_update_scores_writes_by_pk():
    db = _FakeDb()

    await score_repo.update_scores(db, [ScoreUpdate(1, Decimal("4.90"), Decimal("1.95"))])

    sql, params = db.executed[0]
    assert "WHERE preference_score_id = :preference_score_id" in sql
    assert params == [
        {"preference_score_id": 1, "score_sum": Decimal("4.90"), "exposure_count": Decimal("1.95")}
    ]


async def test_update_scores_skips_empty():
    db = _FakeDb()

    await score_repo.update_scores(db, [])

    assert db.executed == []
