"""추천 결과 저장 테스트. DB는 가짜로 바꿔 끼운다."""

import pytest

from app.repositories.clothing import ClothingSnapshot
from app.repositories.essential_item import EssentialItemSnapshot
from app.repositories.recommendation_deck import OutfitItemRow
from app.services import recommendation_save as save
from app.services.essential_supplement import SupplementedCandidate, SupplementResult
from app.services.outfit_generator import FALLBACK_REASON, DraftOutfit


def _candidate(
    item_id: int, category_cd: str, source_cd: str = "owned", accessory_type_cd=None
) -> SupplementedCandidate:
    return SupplementedCandidate(
        item_id=item_id,
        source_cd=source_cd,
        category_cd=category_cd,
        accessory_type_cd=accessory_type_cd,
        item_name=f"item-{item_id}",
        color_cd="black",
        styles=["minimal"],
        thickness_cd="medium",
        is_waterproof=False,
        seasons=[],
    )


def _clothing(
    clothing_id: int,
    item_name: str | None = None,
    color_nm: str | None = "블랙",
    cutout: str | None = None,
    category_cd: str = "top",
    accessory_type_cd: str | None = None,
) -> ClothingSnapshot:
    return ClothingSnapshot(
        clothing_id=clothing_id,
        category_cd=category_cd,
        accessory_type_cd=accessory_type_cd,
        item_name=item_name,
        color_nm=color_nm,
        origin_image_url=f"http://img/{clothing_id}/origin.png",
        cutout_image_url=cutout,
    )


CANDIDATES = [
    _candidate(10, "outer"),
    _candidate(11, "top"),
    _candidate(12, "bottom"),
    _candidate(31, "shoes", source_cd="essential"),
    _candidate(32, "bottom", source_cd="essential"),
]
BY_KEY = {c.key: c for c in CANDIDATES}
CLOTHING = {
    10: _clothing(10, "네이비 블레이저", cutout="http://img/10/cutout.png", category_cd="outer"),
    11: _clothing(11, None, color_nm="화이트"),
    12: _clothing(12, "슬랙스", category_cd="bottom"),
}
ESSENTIALS = {
    31: EssentialItemSnapshot(31, "블랙 로퍼", None),
    32: EssentialItemSnapshot(32, "베이지 치노", "http://img/e32.png"),
}


# ---------- 행 변환 ----------


def test_rows_renumber_seq_and_order_items_by_slot():
    outfits = [
        DraftOutfit(1, "preferred", ("e31", "o12", "o11", "o10"), "사유1"),
        DraftOutfit(2, "exploratory", ("o11", "e32", "e31"), "사유2"),
        DraftOutfit(4, "preferred", ("o11", "o12", "e31"), FALLBACK_REASON, is_fallback=True),
    ]

    rows = save.build_outfit_rows(outfits, BY_KEY, CLOTHING, ESSENTIALS)

    assert [r.outfit_seq for r in rows] == [1, 2, 3]
    assert [r.outfit_type_cd for r in rows] == ["preferred", "exploratory", "preferred"]
    assert rows[2].reason == FALLBACK_REASON
    assert [i.slot_cd for i in rows[0].items] == ["outer", "top", "bottom", "shoes"]


def test_owned_item_snapshot_prefers_cutout_and_keeps_name():
    rows = save.build_outfit_rows(
        [DraftOutfit(1, "preferred", ("o10",), "r")], BY_KEY, CLOTHING, ESSENTIALS
    )

    assert rows[0].items[0] == OutfitItemRow(
        slot_cd="outer",
        item_source_cd="owned",
        clothing_id=10,
        essential_item_id=None,
        item_name_snapshot="네이비 블레이저",
        image_url_snapshot="http://img/10/cutout.png",
    )


def test_owned_item_without_cutout_uses_origin_and_without_name_uses_color_and_category():
    rows = save.build_outfit_rows(
        [DraftOutfit(1, "preferred", ("o11",), "r")], BY_KEY, CLOTHING, ESSENTIALS
    )

    item = rows[0].items[0]
    assert item.item_name_snapshot == "화이트 상의"
    assert item.image_url_snapshot == "http://img/11/origin.png"


@pytest.mark.parametrize(
    ("candidate", "snapshot", "expected"),
    [
        (_candidate(11, "top"), _clothing(11, color_nm=None), "상의"),
        (
            _candidate(20, "accessories", accessory_type_cd="hat"),
            _clothing(20, category_cd="accessories", accessory_type_cd="hat"),
            "블랙 모자",
        ),
        (
            _candidate(21, "accessories"),
            _clothing(21, category_cd="accessories"),
            "블랙 악세서리",
        ),
    ],
)
def test_fallback_name_variants(candidate, snapshot, expected):
    rows = save.build_outfit_rows(
        [DraftOutfit(1, "preferred", (candidate.key,), "r")],
        {candidate.key: candidate},
        {snapshot.clothing_id: snapshot},
        {},
    )

    assert rows[0].items[0].item_name_snapshot == expected


def test_essential_item_snapshot_allows_null_image():
    rows = save.build_outfit_rows(
        [DraftOutfit(1, "preferred", ("e31", "e32"), "r")], BY_KEY, CLOTHING, ESSENTIALS
    )

    shoes, bottom = rows[0].items[1], rows[0].items[0]
    assert shoes == OutfitItemRow(
        slot_cd="shoes",
        item_source_cd="essential",
        clothing_id=None,
        essential_item_id=31,
        item_name_snapshot="블랙 로퍼",
        image_url_snapshot=None,
    )
    assert bottom.image_url_snapshot == "http://img/e32.png"


def test_missing_clothing_snapshot_raises():
    with pytest.raises(ValueError, match="clothing_id=11"):
        save.build_outfit_rows([DraftOutfit(1, "preferred", ("o11",), "r")], BY_KEY, {}, ESSENTIALS)


def test_more_than_one_exploratory_raises():
    outfits = [
        DraftOutfit(1, "exploratory", ("o11",), "r"),
        DraftOutfit(2, "exploratory", ("o12",), "r"),
    ]

    with pytest.raises(ValueError, match="탐색 코디"):
        save.build_outfit_rows(outfits, BY_KEY, CLOTHING, ESSENTIALS)


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


def _patch_repos(monkeypatch, *, completed=True, clothing=None):
    factory = _FakeSessionFactory()
    calls = []
    next_id = iter(range(100, 200))

    async def complete_generation(db, session_id, is_clothing_shortage):
        calls.append(("complete", session_id, is_clothing_shortage))
        return completed

    async def get_clothing_snapshots(db, member_id, ids):
        calls.append(("clothing", member_id, list(ids)))
        return CLOTHING if clothing is None else clothing

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

    monkeypatch.setattr(save, "AsyncSessionLocal", factory)
    monkeypatch.setattr(save.session_repo, "complete_generation", complete_generation)
    monkeypatch.setattr(save.clothing_repo, "get_clothing_snapshots", get_clothing_snapshots)
    monkeypatch.setattr(
        save.essential_item_repo, "get_essential_item_snapshots", get_essential_item_snapshots
    )
    monkeypatch.setattr(save.deck_repo, "insert_deck", insert_deck)
    monkeypatch.setattr(save.deck_repo, "insert_outfit", insert_outfit)
    monkeypatch.setattr(save.deck_repo, "insert_outfit_items", insert_outfit_items)
    return factory, calls


def _supplement(shortage=False) -> SupplementResult:
    return SupplementResult(
        candidates=CANDIDATES, is_clothing_shortage=shortage, outer_requirement="optional"
    )


async def test_save_writes_status_deck_outfits_items_in_one_transaction(monkeypatch):
    factory, calls = _patch_repos(monkeypatch)
    outfits = [
        DraftOutfit(2, "preferred", ("o11", "o12", "e31"), "사유1"),
        DraftOutfit(4, "exploratory", ("o11", "e32", "e31"), "사유2"),
    ]

    await save.save_recommendation_result(7, 1, outfits, _supplement(shortage=True))

    assert calls == [
        ("complete", 7, True),
        ("clothing", 1, [11, 12]),
        ("essential", [31, 32]),
        ("deck", 7, 1, "initial"),
        ("outfit", 100, 1, "preferred", "사유1"),
        ("items", 101, ["화이트 상의", "슬랙스", "블랙 로퍼"]),
        ("outfit", 100, 2, "exploratory", "사유2"),
        ("items", 102, ["화이트 상의", "베이지 치노", "블랙 로퍼"]),
    ]
    assert [db.events for db in factory.sessions] == [["commit"]]


async def test_save_rolls_back_without_insert_when_session_not_processing(monkeypatch):
    factory, calls = _patch_repos(monkeypatch, completed=False)

    with pytest.raises(save.GenerationNotProcessingError):
        await save.save_recommendation_result(
            7, 1, [DraftOutfit(1, "preferred", ("o11",), "r")], _supplement()
        )

    assert [c[0] for c in calls] == ["complete"]
    assert factory.sessions[0].events == ["rollback"]


async def test_save_rolls_back_when_clothing_was_deleted(monkeypatch):
    factory, calls = _patch_repos(monkeypatch, clothing={})

    with pytest.raises(ValueError):
        await save.save_recommendation_result(
            7, 1, [DraftOutfit(1, "preferred", ("o11",), "r")], _supplement()
        )

    assert "deck" not in [c[0] for c in calls]
    assert factory.sessions[0].events == ["rollback"]


# ---------- 실패 표시 ----------


@pytest.mark.parametrize("shortage", [None, True])
async def test_mark_failed_passes_shortage_and_commits(monkeypatch, shortage):
    factory = _FakeSessionFactory()
    calls = []

    async def mark_generation_failed(db, session_id, is_clothing_shortage):
        calls.append((session_id, is_clothing_shortage))
        return True

    monkeypatch.setattr(save, "AsyncSessionLocal", factory)
    monkeypatch.setattr(save.session_repo, "mark_generation_failed", mark_generation_failed)

    await save.mark_generation_failed(7, shortage)

    assert calls == [(7, shortage)]
    assert factory.sessions[0].events == ["commit"]


async def test_mark_failed_does_not_overwrite_finished_session(monkeypatch, caplog):
    async def mark_generation_failed(db, session_id, is_clothing_shortage):
        return False

    monkeypatch.setattr(save, "AsyncSessionLocal", _FakeSessionFactory())
    monkeypatch.setattr(save.session_repo, "mark_generation_failed", mark_generation_failed)

    await save.mark_generation_failed(7)

    assert "recommend.mark_failed.skipped session_id=7" in caplog.text


async def test_mark_failed_swallows_errors(monkeypatch, caplog):
    async def mark_generation_failed(db, session_id, is_clothing_shortage):
        raise RuntimeError("db down")

    monkeypatch.setattr(save, "AsyncSessionLocal", _FakeSessionFactory())
    monkeypatch.setattr(save.session_repo, "mark_generation_failed", mark_generation_failed)

    await save.mark_generation_failed(7)

    assert "recommend.mark_failed.failed session_id=7" in caplog.text
