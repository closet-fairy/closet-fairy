"""추천 결과(덱·코디·코디 아이템) 저장 리포지토리 테스트."""

from app.repositories import recommendation_deck as deck_repo
from app.repositories.recommendation_deck import OutfitItemRow


class _Result:
    def __init__(self, lastrowid):
        self.lastrowid = lastrowid


class _FakeDb:
    def __init__(self):
        self.executed = []
        self.committed = False

    async def execute(self, statement, params):
        self.executed.append((str(statement), params))
        return _Result(len(self.executed))

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
