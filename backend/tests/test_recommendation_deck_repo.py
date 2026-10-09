"""추천 결과(덱·코디·코디 아이템) 저장 리포지토리 테스트."""

from types import SimpleNamespace

from app.repositories import recommendation_deck as deck_repo
from app.repositories.recommendation_deck import OutfitItemRow


class _Result:
    def __init__(self, lastrowid, rows=(), rowcount=0):
        self.lastrowid = lastrowid
        self.rowcount = rowcount
        self._rows = rows

    def __iter__(self):
        return iter(self._rows)


class _FakeDb:
    def __init__(self, rows=(), rowcount=0):
        self.executed = []
        self.committed = False
        self._rows = [SimpleNamespace(**r) for r in rows]
        self._rowcount = rowcount

    async def execute(self, statement, params):
        self.executed.append((str(statement), params))
        return _Result(len(self.executed), self._rows, self._rowcount)

    async def commit(self):
        self.committed = True


async def test_insert_deck_and_outfit_return_new_ids_without_commit():
    db = _FakeDb()

    deck_id = await deck_repo.insert_deck(db, 7, 1, "initial")
    outfit_id = await deck_repo.insert_outfit(db, deck_id, 1, "exploratory", None)

    assert (deck_id, outfit_id) == (1, 2)
    assert "INSERT INTO recommendation_deck" in db.executed[0][0]
    assert db.executed[0][1] == {
        "recommendation_session_id": 7,
        "deck_seq": 1,
        "deck_trigger_cd": "initial",
    }
    assert db.executed[1][1] == {
        "recommendation_deck_id": 1,
        "outfit_seq": 1,
        "outfit_type_cd": "exploratory",
        "reason": None,
    }
    assert not db.committed


async def test_insert_outfit_items_sends_all_items_at_once():
    db = _FakeDb()
    items = [
        OutfitItemRow("top", "owned", 11, None, "화이트 상의", "http://a/11.png"),
        OutfitItemRow("shoes", "essential", None, 31, "블랙 로퍼", None),
    ]

    await deck_repo.insert_outfit_items(db, 5, items)

    sql, params = db.executed[0]
    assert "INSERT INTO outfit_item" in sql
    assert params == [
        {
            "outfit_id": 5,
            "slot_cd": "top",
            "item_source_cd": "owned",
            "clothing_id": 11,
            "essential_item_id": None,
            "item_name_snapshot": "화이트 상의",
            "image_url_snapshot": "http://a/11.png",
        },
        {
            "outfit_id": 5,
            "slot_cd": "shoes",
            "item_source_cd": "essential",
            "clothing_id": None,
            "essential_item_id": 31,
            "item_name_snapshot": "블랙 로퍼",
            "image_url_snapshot": None,
        },
    ]
    assert not db.committed


async def test_find_session_outfit_ids_spans_every_deck():
    db = _FakeDb([{"outfit_id": 101}, {"outfit_id": 201}])

    ids = await deck_repo.find_session_outfit_ids(db, 7)

    sql, params = db.executed[0]
    assert "d.recommendation_session_id = :recommendation_session_id" in sql
    assert "ORDER BY d.deck_seq, o.outfit_seq" in sql
    assert ids == [101, 201]


async def test_delete_outfits_except_keeps_only_given_outfit_in_session():
    db = _FakeDb(rowcount=3)

    deleted = await deck_repo.delete_outfits_except(db, 7, 102)

    sql, params = db.executed[0]
    assert "DELETE o FROM outfit o" in sql
    assert "d.recommendation_session_id = :recommendation_session_id" in sql
    assert "o.outfit_id <> :keep_outfit_id" in sql
    assert params == {"recommendation_session_id": 7, "keep_outfit_id": 102}
    assert deleted == 3
    assert not db.committed


async def test_delete_empty_decks_only_in_session():
    db = _FakeDb(rowcount=1)

    deleted = await deck_repo.delete_empty_decks(db, 7)

    sql, params = db.executed[0]
    assert "DELETE d FROM recommendation_deck d" in sql
    assert "LEFT JOIN outfit o" in sql
    assert "d.recommendation_session_id = :recommendation_session_id" in sql
    assert "o.outfit_id IS NULL" in sql
    assert params == {"recommendation_session_id": 7}
    assert deleted == 1
    assert not db.committed


async def test_delete_session_decks_removes_every_deck_of_session():
    db = _FakeDb(rowcount=2)

    deleted = await deck_repo.delete_session_decks(db, 7)

    sql, params = db.executed[0]
    assert "DELETE FROM recommendation_deck" in sql
    assert "WHERE recommendation_session_id = :recommendation_session_id" in sql
    assert params == {"recommendation_session_id": 7}
    assert deleted == 2
    assert not db.committed
