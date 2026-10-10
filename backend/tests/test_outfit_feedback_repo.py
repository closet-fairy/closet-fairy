"""코디 피드백 리포지토리 테스트."""

from decimal import Decimal
from types import SimpleNamespace

from app.repositories import outfit_feedback as feedback_repo
from app.repositories.outfit_feedback import FeedbackRow


class _Result:
    def __init__(self, rows):
        self._rows = rows

    def __iter__(self):
        return iter(self._rows)

    def scalar_one_or_none(self):
        return self._rows[0].outfit_id if self._rows else None


class _FakeDb:
    def __init__(self, rows=()):
        self.executed = []
        self.committed = False
        self._rows = [SimpleNamespace(**r) for r in rows]

    async def execute(self, statement, params):
        self.executed.append((str(statement), params))
        return _Result(self._rows)

    async def commit(self):
        self.committed = True


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


async def test_find_rated_outfit_id_reads_rated_feedback_of_session():
    db = _FakeDb([{"outfit_id": 102}])

    outfit_id = await feedback_repo.find_rated_outfit_id(db, 7)

    sql, params = db.executed[0]
    assert "recommendation_session_id = :recommendation_session_id" in sql
    assert "feedback_type_cd = 'rated'" in sql
    assert params == {"recommendation_session_id": 7}
    assert outfit_id == 102


async def test_find_rated_outfit_id_returns_none_without_rating():
    assert await feedback_repo.find_rated_outfit_id(_FakeDb(), 7) is None
