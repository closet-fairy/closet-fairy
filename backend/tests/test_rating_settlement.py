"""별점 부여 + 세션 종료 정산 테스트. DB는 가짜로 바꿔 끼운다."""

from datetime import datetime
from decimal import Decimal

import pytest
from sqlalchemy.exc import IntegrityError

from app.core.config import Settings
from app.repositories.outfit_feedback import AttributeFeedback, FeedbackRow
from app.repositories.preference_score import ScoreRow, ScoreUpdate
from app.repositories.recommendation_session import RatingSessionRow
from app.services import rating_settlement as settlement
from app.services.weather.base_time import KST

SETTINGS = Settings(_env_file=None)
FIXED_NOW = datetime(2026, 10, 9, 21, 30, tzinfo=KST)


def _af(type_cd, value, feedback_type_cd, delta) -> AttributeFeedback:
    return AttributeFeedback(type_cd, value, feedback_type_cd, Decimal(delta))


# ---------- 별점 델타 ----------


@pytest.mark.parametrize(
    ("rating", "expected"),
    [(5, "3.0"), (4, "2.0"), (3, "1.0"), (2, "0.0"), (1, "-1.0")],
)
def test_rating_delta_comes_from_settings(rating, expected):
    assert settlement.rating_delta(rating, SETTINGS) == Decimal(expected)


def test_rating_delta_follows_overridden_settings():
    settings = Settings(_env_file=None, SCORE_DELTA_RATING_5=Decimal("2.5"))

    assert settlement.rating_delta(5, settings) == Decimal("2.5")


# ---------- 겹침 규칙 ----------


def test_rated_delta_wins_over_rejections():
    rows = [
        _af("style", "minimal", "auto_rejected", "-0.1"),
        _af("style", "minimal", "rated", "3.0"),
        _af("style", "minimal", "auto_rejected", "-0.1"),
    ]

    assert settlement.resolve_attribute_deltas(rows) == {("style", "minimal"): Decimal("3.0")}


def test_rated_zero_delta_is_kept_not_flipped_to_negative():
    rows = [
        _af("style", "casual", "rated", "0.0"),
        _af("style", "casual", "auto_rejected", "-0.1"),
    ]

    assert settlement.resolve_attribute_deltas(rows) == {("style", "casual"): Decimal("0.0")}


def test_rated_negative_delta_wins_over_weaker_rejection():
    rows = [
        _af("color", "black", "auto_rejected", "-0.1"),
        _af("color", "black", "rated", "-1.0"),
    ]

    assert settlement.resolve_attribute_deltas(rows) == {("color", "black"): Decimal("-1.0")}


def test_non_rated_attribute_takes_strongest_negative_once():
    rows = [
        _af("style", "street", "auto_rejected", "-0.1"),
        _af("style", "street", "regeneration_requested", "-0.5"),
        _af("style", "street", "auto_rejected", "-0.1"),
    ]

    assert settlement.resolve_attribute_deltas(rows) == {("style", "street"): Decimal("-0.5")}


def test_same_color_on_two_items_of_one_outfit_counts_once():
    rows = [
        _af("color", "black", "auto_rejected", "-0.1"),
        _af("color", "black", "auto_rejected", "-0.1"),
    ]

    assert settlement.resolve_attribute_deltas(rows) == {("color", "black"): Decimal("-0.1")}


def test_style_and_color_with_same_value_are_separate_keys():
    rows = [
        _af("style", "minimal", "rated", "3.0"),
        _af("color", "white", "rated", "3.0"),
        _af("color", "beige", "auto_rejected", "-0.1"),
    ]

    assert settlement.resolve_attribute_deltas(rows) == {
        ("style", "minimal"): Decimal("3.0"),
        ("color", "white"): Decimal("3.0"),
        ("color", "beige"): Decimal("-0.1"),
    }


def test_no_rows_gives_no_deltas():
    assert settlement.resolve_attribute_deltas([]) == {}


# ---------- 점수 갱신 계획 ----------


def _score(pk, type_cd, value, s="0.00", n="0.00") -> ScoreRow:
    return ScoreRow(pk, type_cd, value, Decimal(s), Decimal(n))


def test_exposed_attributes_get_ema_update():
    rows = [_score(1, "style", "minimal", "2.00", "1.00")]

    updates = settlement.plan_score_updates(rows, {("style", "minimal"): Decimal("3.0")}, SETTINGS)

    assert updates == [ScoreUpdate(1, Decimal("4.90"), Decimal("1.95"))]


def test_rated_two_with_rejection_keeps_positive_score():
    rows = [
        _af("style", "casual", "rated", "0.0"),
        _af("style", "casual", "auto_rejected", "-0.1"),
    ]
    deltas = settlement.resolve_attribute_deltas(rows)

    updates = settlement.plan_score_updates(
        [_score(2, "style", "casual", "2.00", "1.00")], deltas, SETTINGS
    )

    assert updates == [ScoreUpdate(2, Decimal("1.90"), Decimal("1.95"))]


def test_unexposed_attributes_only_decay_without_exposure_increase():
    rows = [
        _score(1, "style", "minimal", "2.00", "1.00"),
        _score(2, "style", "casual", "5.00", "3.00"),
        _score(3, "style", "street", "-4.00", "4.00"),
    ]

    updates = settlement.plan_score_updates(rows, {("style", "minimal"): Decimal("-0.1")}, SETTINGS)

    assert updates == [
        ScoreUpdate(1, Decimal("1.80"), Decimal("1.95")),
        ScoreUpdate(2, Decimal("4.75"), Decimal("2.85")),
        ScoreUpdate(3, Decimal("-3.80"), Decimal("3.80")),
    ]


def test_unexposed_rows_that_do_not_change_are_not_written():
    rows = [
        _score(1, "style", "minimal", "2.00", "1.00"),
        _score(15, "color", "black"),
        _score(16, "color", "white", "0.00", "0.10"),
    ]

    updates = settlement.plan_score_updates(rows, {("style", "minimal"): Decimal("3.0")}, SETTINGS)

    assert [u.preference_score_id for u in updates] == [1]


# ---------- 트랜잭션 ----------


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


class _DuplicateEntry(Exception):
    def __init__(self):
        super().__init__(1062, "Duplicate entry")


class _ForeignKeyFailure(Exception):
    def __init__(self):
        super().__init__(1452, "Cannot add or update a child row")


ACTIVE = RatingSessionRow(
    member_id=1, session_status_cd="active", generation_status_cd="completed", settled_at=None
)
SCORES = [
    _score(1, "style", "minimal", "2.00", "1.00"),
    _score(2, "style", "casual", "2.00", "1.00"),
    _score(3, "style", "street", "-4.00", "4.00"),
    _score(15, "color", "black"),
    _score(16, "color", "white"),
]
ATTRIBUTE_FEEDBACKS = [
    _af("style", "minimal", "rated", "3.0"),
    _af("color", "black", "rated", "3.0"),
    _af("style", "casual", "auto_rejected", "-0.1"),
    _af("color", "black", "auto_rejected", "-0.1"),
]


def _patch_repos(
    monkeypatch,
    *,
    session=ACTIVE,
    outfit_ids=(101, 102, 201),
    scores=SCORES,
    attribute_feedbacks=ATTRIBUTE_FEEDBACKS,
    completed=True,
    insert_error=None,
):
    calls = []

    async def lock_session_for_rating(db, session_id):
        calls.append(("lock_session", session_id))
        return session

    async def find_session_outfit_ids(db, session_id):
        calls.append(("outfit_ids", session_id))
        return list(outfit_ids)

    async def insert_feedbacks(db, session_id, rows):
        calls.append(("insert_feedbacks", session_id, list(rows)))
        if insert_error is not None:
            raise IntegrityError("INSERT", {}, insert_error)

    async def find_session_attribute_feedbacks(db, session_id):
        calls.append(("attribute_feedbacks", session_id))
        return list(attribute_feedbacks)

    async def lock_member_scores(db, member_id):
        calls.append(("lock_scores", member_id))
        return list(scores)

    async def update_scores(db, updates):
        calls.append(("update_scores", list(updates)))

    async def complete_settlement(db, session_id, settled_at):
        calls.append(("complete", session_id, settled_at))
        return completed

    monkeypatch.setattr(settlement.session_repo, "lock_session_for_rating", lock_session_for_rating)
    monkeypatch.setattr(settlement.deck_repo, "find_session_outfit_ids", find_session_outfit_ids)
    monkeypatch.setattr(settlement.feedback_repo, "insert_feedbacks", insert_feedbacks)
    monkeypatch.setattr(
        settlement.feedback_repo,
        "find_session_attribute_feedbacks",
        find_session_attribute_feedbacks,
    )
    monkeypatch.setattr(settlement.score_repo, "lock_member_scores", lock_member_scores)
    monkeypatch.setattr(settlement.score_repo, "update_scores", update_scores)
    monkeypatch.setattr(settlement.session_repo, "complete_settlement", complete_settlement)
    return calls


async def _rate(db, *, member_id=1, outfit_id=102, rating=5):
    await settlement.rate_and_settle(db, 7, member_id, outfit_id, rating, FIXED_NOW)


async def test_settles_whole_session_in_one_transaction_with_session_locked_first(monkeypatch):
    calls = _patch_repos(monkeypatch)
    db = _FakeDb()

    await _rate(db)

    assert [c[0] for c in calls] == [
        "lock_session",
        "outfit_ids",
        "insert_feedbacks",
        "attribute_feedbacks",
        "lock_scores",
        "update_scores",
        "complete",
    ]
    assert db.events == ["commit"]


async def test_feedback_rows_cover_every_outfit_with_rated_and_auto_rejected(monkeypatch):
    calls = _patch_repos(monkeypatch)

    await _rate(_FakeDb(), outfit_id=102, rating=2)

    _, session_id, rows = calls[2]
    assert session_id == 7
    assert rows == [
        FeedbackRow(101, "auto_rejected", None, SETTINGS.SCORE_DELTA_AUTO_REJECTED),
        FeedbackRow(102, "rated", 2, SETTINGS.SCORE_DELTA_RATING_2),
        FeedbackRow(201, "auto_rejected", None, SETTINGS.SCORE_DELTA_AUTO_REJECTED),
    ]


async def test_outfit_from_earlier_deck_can_be_rated(monkeypatch):
    calls = _patch_repos(monkeypatch)

    await _rate(_FakeDb(), outfit_id=101)

    rows = calls[2][2]
    assert [r.feedback_type_cd for r in rows] == ["rated", "auto_rejected", "auto_rejected"]


async def test_score_updates_and_settled_time_are_written(monkeypatch):
    calls = _patch_repos(monkeypatch)

    await _rate(_FakeDb())

    assert calls[4] == ("lock_scores", 1)
    assert calls[5] == (
        "update_scores",
        [
            ScoreUpdate(1, Decimal("4.90"), Decimal("1.95")),
            ScoreUpdate(2, Decimal("1.80"), Decimal("1.95")),
            ScoreUpdate(3, Decimal("-3.80"), Decimal("3.80")),
            ScoreUpdate(15, Decimal("3.00"), Decimal("1.00")),
        ],
    )
    assert calls[6] == ("complete", 7, datetime(2026, 10, 9, 12, 30))


async def test_missing_score_row_is_skipped_with_warning(monkeypatch, caplog):
    feedbacks = [*ATTRIBUTE_FEEDBACKS, _af("color", "pink", "auto_rejected", "-0.1")]
    calls = _patch_repos(monkeypatch, attribute_feedbacks=feedbacks)

    await _rate(_FakeDb())

    assert [u.preference_score_id for u in calls[5][1]] == [1, 2, 3, 15]
    warning = next(r for r in caplog.records if r.levelname == "WARNING")
    assert warning.missing_attributes == ["color:pink"]


async def test_settled_event_logs_counts_only(monkeypatch, caplog):
    _patch_repos(monkeypatch)
    caplog.set_level("INFO")

    await _rate(_FakeDb())

    record = next(r for r in caplog.records if getattr(r, "event", None) == "preference.settled")
    assert record.recommendation_session_id == 7
    assert record.outfit_count == 3
    assert record.exposed_attribute_count == 3
    assert record.updated_row_count == 4
    assert record.rated_delta == Decimal("3.0")
    assert not hasattr(record, "rating")


@pytest.mark.parametrize(
    "session",
    [None, RatingSessionRow(2, "active", "completed", None)],
    ids=["missing", "other-member"],
)
async def test_missing_or_other_members_session_is_404(monkeypatch, session):
    calls = _patch_repos(monkeypatch, session=session)
    db = _FakeDb()

    with pytest.raises(settlement.SessionNotFoundError):
        await _rate(db)

    assert [c[0] for c in calls] == ["lock_session"]
    assert db.events == ["rollback"]


async def test_already_settled_session_is_409_and_writes_nothing(monkeypatch):
    settled = RatingSessionRow(1, "completed", "completed", datetime(2026, 10, 9, 12, 0))
    calls = _patch_repos(monkeypatch, session=settled)

    with pytest.raises(settlement.SessionAlreadySettledError):
        await _rate(_FakeDb())

    assert [c[0] for c in calls] == ["lock_session"]


@pytest.mark.parametrize(
    ("status", "generation"),
    [
        ("canceled", "completed"),
        ("abandoned", "completed"),
        ("completed", "completed"),
        ("active", "processing"),
        ("active", "failed"),
    ],
)
async def test_unratable_session_is_409(monkeypatch, status, generation):
    calls = _patch_repos(monkeypatch, session=RatingSessionRow(1, status, generation, None))

    with pytest.raises(settlement.SessionNotRatableError):
        await _rate(_FakeDb())

    assert [c[0] for c in calls] == ["lock_session"]


async def test_outfit_outside_session_is_404(monkeypatch):
    calls = _patch_repos(monkeypatch)

    with pytest.raises(settlement.OutfitNotInSessionError):
        await _rate(_FakeDb(), outfit_id=999)

    assert [c[0] for c in calls] == ["lock_session", "outfit_ids"]


async def test_lost_settlement_race_is_409_and_rolls_back(monkeypatch):
    _patch_repos(monkeypatch, completed=False)
    db = _FakeDb()

    with pytest.raises(settlement.SessionAlreadySettledError):
        await _rate(db)

    assert db.events == ["rollback"]


async def test_duplicate_feedback_is_409(monkeypatch):
    _patch_repos(monkeypatch, insert_error=_DuplicateEntry())
    db = _FakeDb()

    with pytest.raises(settlement.SessionAlreadySettledError):
        await _rate(db)

    assert db.events == ["rollback"]


async def test_other_integrity_error_is_reraised(monkeypatch):
    _patch_repos(monkeypatch, insert_error=_ForeignKeyFailure())

    with pytest.raises(IntegrityError):
        await _rate(_FakeDb())
