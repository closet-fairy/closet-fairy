"""재추천 결과 저장 테스트. DB는 가짜로 바꿔 끼운다."""

from datetime import datetime

import pytest

from app.repositories.clothing import ClothingSnapshot
from app.repositories.essential_item import EssentialItemSnapshot
from app.repositories.recommendation_session import SessionStateRow
from app.services import recommendation_save as save
from app.services import regeneration_save as regen_save
from app.services.essential_supplement import SupplementedCandidate, SupplementResult
from app.services.outfit_generator import DraftOutfit


def _candidate(item_id: int, category_cd: str, source_cd: str = "owned") -> SupplementedCandidate:
    return SupplementedCandidate(
        item_id=item_id,
        source_cd=source_cd,
        category_cd=category_cd,
        accessory_type_cd=None,
        item_name=f"item-{item_id}",
        color_cd="black",
        styles=["minimal"],
        thickness_cd="medium",
        is_waterproof=False,
        seasons=[],
    )


SUPPLEMENT = SupplementResult(
    candidates=[
        _candidate(11, "top"),
        _candidate(12, "bottom"),
        _candidate(31, "shoes", "essential"),
    ],
    is_clothing_shortage=False,
    outer_requirement="optional",
)
CLOTHING = {
    11: ClothingSnapshot(11, "화이트 셔츠", "화이트", "http://img/11.png", None, None),
    12: ClothingSnapshot(12, "슬랙스", "블랙", "http://img/12.png", None, None),
}
ESSENTIALS = {31: EssentialItemSnapshot(31, "블랙 로퍼", None)}
ACTIVE = SessionStateRow(
    member_id=1, session_status_cd="active", generation_status_cd="completed", settled_at=None
)
OUTFITS = [DraftOutfit(2, "preferred", ("o11", "o12", "e31"), "사유")]


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


class _FakeSessionFactory:
    def __init__(self):
        self.sessions = []

    def __call__(self):
        db = _FakeDb()
        self.sessions.append(db)
        return _Context(db)


class _Context:
    def __init__(self, db):
        self._db = db

    async def __aenter__(self):
        return self._db

    async def __aexit__(self, exc_type, exc, tb):
        return False


def _patch_repos(monkeypatch, *, session=ACTIVE, completed=True, next_seq=3):
    factory = _FakeSessionFactory()
    calls = []
    next_id = iter(range(500, 600))

    async def lock_session(db, session_id):
        calls.append(("lock_session", session_id))
        return session

    async def next_deck_seq(db, session_id):
        calls.append(("next_deck_seq", session_id))
        return next_seq

    async def get_clothing_snapshots(db, member_id, ids):
        calls.append(("clothing", member_id, list(ids)))
        return CLOTHING

    async def get_essential_item_snapshots(db, ids):
        calls.append(("essential", list(ids)))
        return ESSENTIALS

    async def insert_deck(db, session_id, deck_seq, trigger):
        calls.append(("deck", session_id, deck_seq, trigger))
        return next(next_id)

    async def insert_outfit(db, deck_id, outfit_seq, outfit_type_cd, reason):
        calls.append(("outfit", deck_id, outfit_seq, outfit_type_cd, reason))
        return next(next_id)

    async def insert_outfit_items(db, outfit_id, items):
        calls.append(("items", outfit_id, [i.item_name_snapshot for i in items]))

    async def complete_request(db, request_id, result_deck_id):
        calls.append(("complete_request", request_id, result_deck_id))
        return completed

    monkeypatch.setattr(regen_save, "AsyncSessionLocal", factory)
    monkeypatch.setattr(regen_save.session_repo, "lock_session", lock_session)
    monkeypatch.setattr(regen_save.deck_repo, "next_deck_seq", next_deck_seq)
    monkeypatch.setattr(regen_save.deck_repo, "insert_deck", insert_deck)
    monkeypatch.setattr(regen_save.deck_repo, "insert_outfit", insert_outfit)
    monkeypatch.setattr(regen_save.deck_repo, "insert_outfit_items", insert_outfit_items)
    monkeypatch.setattr(regen_save.regeneration_repo, "complete_request", complete_request)
    monkeypatch.setattr(save.clothing_repo, "get_clothing_snapshots", get_clothing_snapshots)
    monkeypatch.setattr(
        save.essential_item_repo, "get_essential_item_snapshots", get_essential_item_snapshots
    )
    return factory, calls


async def _save():
    return await regen_save.save_regeneration_result(9, 7, 1, OUTFITS, SUPPLEMENT)


async def test_saves_new_regeneration_deck_keeping_target_seq(monkeypatch):
    factory, calls = _patch_repos(monkeypatch)

    deck_seq = await _save()

    assert deck_seq == 3
    assert calls == [
        ("lock_session", 7),
        ("next_deck_seq", 7),
        ("clothing", 1, [11, 12]),
        ("essential", [31]),
        ("deck", 7, 3, "regeneration"),
        ("outfit", 500, 2, "preferred", "사유"),
        ("items", 501, ["화이트 셔츠", "슬랙스", "블랙 로퍼"]),
        ("complete_request", 9, 500),
    ]
    assert [db.events for db in factory.sessions] == [["commit"]]


@pytest.mark.parametrize(
    "session",
    [
        None,
        SessionStateRow(1, "canceled", "completed", None),
        SessionStateRow(1, "abandoned", "completed", None),
        SessionStateRow(1, "completed", "completed", datetime(2026, 10, 25, 12, 0)),
    ],
    ids=["missing", "canceled", "abandoned", "settled"],
)
async def test_ended_session_discards_without_insert(monkeypatch, session):
    factory, calls = _patch_repos(monkeypatch, session=session)

    with pytest.raises(regen_save.RegenerationDiscardedError) as exc_info:
        await _save()

    assert exc_info.value.reason == "session_ended"
    assert [c[0] for c in calls] == ["lock_session"]
    assert factory.sessions[0].events == ["rollback"]


async def test_request_no_longer_processing_discards_and_rolls_back_deck(monkeypatch):
    factory, calls = _patch_repos(monkeypatch, completed=False)

    with pytest.raises(regen_save.RegenerationDiscardedError) as exc_info:
        await _save()

    assert exc_info.value.reason == "not_processing"
    assert calls[-1] == ("complete_request", 9, 500)
    assert factory.sessions[0].events == ["rollback"]


# ---------- 실패 표시 ----------


@pytest.mark.parametrize("changed", [True, False])
async def test_mark_failed_returns_whether_request_changed(monkeypatch, changed):
    factory = _FakeSessionFactory()
    calls = []

    async def fail_request(db, request_id):
        calls.append(request_id)
        return changed

    monkeypatch.setattr(regen_save, "AsyncSessionLocal", factory)
    monkeypatch.setattr(regen_save.regeneration_repo, "fail_request", fail_request)

    assert await regen_save.mark_regeneration_failed(9) is changed
    assert calls == [9]
    assert factory.sessions[0].events == ["commit"]


async def test_mark_failed_swallows_errors_and_returns_none(monkeypatch, caplog):
    async def fail_request(db, request_id):
        raise RuntimeError("db down")

    monkeypatch.setattr(regen_save, "AsyncSessionLocal", _FakeSessionFactory())
    monkeypatch.setattr(regen_save.regeneration_repo, "fail_request", fail_request)

    assert await regen_save.mark_regeneration_failed(9) is None
    record = next(r for r in caplog.records if r.levelname == "ERROR")
    assert record.regeneration_request_id == 9
