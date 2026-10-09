"""정산 관련 리포지토리 테스트 (피드백 · 세션 잠금 · 선호 점수 잠금)."""

from datetime import datetime
from decimal import Decimal
from types import SimpleNamespace

from app.repositories import outfit_feedback as feedback_repo
from app.repositories import preference_score as score_repo
from app.repositories import recommendation_deck as deck_repo
from app.repositories import recommendation_session as session_repo
from app.repositories.outfit_feedback import FeedbackRow
from app.repositories.preference_score import ScoreUpdate


class _Result:
    def __init__(self, rows, rowcount):
        self._rows = rows
        self.rowcount = rowcount

    def __iter__(self):
        return iter(self._rows)

    def first(self):
        return self._rows[0] if self._rows else None


class _FakeDb:
    def __init__(self, rows=(), rowcount=1):
        self.executed = []
        self.committed = False
        self._rows = [SimpleNamespace(**r) for r in rows]
        self._rowcount = rowcount

    async def execute(self, statement, params):
        self.executed.append((str(statement), params))
        return _Result(self._rows, self._rowcount)

    async def commit(self):
        self.committed = True


async def test_lock_session_for_rating_locks_row():
    db = _FakeDb(
        [
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


async def test_find_session_outfit_ids_spans_every_deck():
    db = _FakeDb([{"outfit_id": 101}, {"outfit_id": 201}])

    ids = await deck_repo.find_session_outfit_ids(db, 7)

    sql, params = db.executed[0]
    assert "d.recommendation_session_id = :recommendation_session_id" in sql
    assert "ORDER BY d.deck_seq, o.outfit_seq" in sql
    assert ids == [101, 201]


async def test_insert_feedbacks_writes_all_rows_without_commit():
    db = _FakeDb()

    await feedback_repo.insert_feedbacks(
        db,
        7,
        [
            FeedbackRow(101, "rated", 5, Decimal("3.0")),
            FeedbackRow(102, "auto_rejected", None, Decimal("-0.1")),
        ],
    )

    sql, params = db.executed[0]
    assert "INSERT INTO outfit_feedback" in sql
    assert params == [
        {
            "outfit_id": 101,
            "recommendation_session_id": 7,
            "feedback_type_cd": "rated",
            "rating": 5,
            "applied_delta": Decimal("3.0"),
        },
        {
            "outfit_id": 102,
            "recommendation_session_id": 7,
            "feedback_type_cd": "auto_rejected",
            "rating": None,
            "applied_delta": Decimal("-0.1"),
        },
    ]
    assert not db.committed


async def test_attribute_feedbacks_union_owned_and_essential_style_and_color():
    db = _FakeDb(
        [
            {
                "attribute_type_cd": "style",
                "attribute_value": "minimal",
                "feedback_type_cd": "rated",
                "applied_delta": Decimal("3.00"),
            }
        ]
    )

    rows = await feedback_repo.find_session_attribute_feedbacks(db, 7)

    sql, params = db.executed[0]
    assert sql.count("UNION ALL") == 3
    assert "JOIN clothing_style cs" in sql
    assert "c.color_cd IS NOT NULL" in sql
    assert sql.count("JOIN essential_item ei") == 2
    assert "feedback_type_cd" in sql
    assert params == {"recommendation_session_id": 7}
    assert rows == [feedback_repo.AttributeFeedback("style", "minimal", "rated", Decimal("3.00"))]


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
