"""REC-09 essential_item 리포지토리 단위 테스트."""

from app.repositories import essential_item as essential_item_repo


class _Row:
    def __init__(self, **kwargs):
        self.__dict__.update(kwargs)


class _FakeResult:
    def __init__(self, rows):
        self._rows = rows

    def all(self):
        return self._rows


class _FakeDb:
    def __init__(self, rows=()):
        self._rows = list(rows)
        self.calls: list[dict] = []

    async def execute(self, stmt, params):
        self.calls.append(params)
        return _FakeResult(self._rows)


async def test_get_essential_items_passes_gender_and_formality_range():
    db = _FakeDb()

    await essential_item_repo.get_essential_items(
        db,
        category_cd="top",
        season_cd="winter",
        gender_cd="female",
        min_formality=2,
        max_formality=5,
    )

    assert db.calls[0] == {
        "category_cd": "top",
        "season_cd": "winter",
        "gender_cd": "female",
        "min_formality": 2,
        "max_formality": 5,
    }


async def test_get_essential_item_snapshots_maps_by_id():
    db = _FakeDb([_Row(essential_item_id=31, item_name="블랙 로퍼", image_url=None)])

    snapshots = await essential_item_repo.get_essential_item_snapshots(db, [31, 32])

    assert db.calls == [{"essential_item_ids": [31, 32]}]
    assert snapshots[31].item_name == "블랙 로퍼"
    assert snapshots[31].image_url is None
    assert 32 not in snapshots


async def test_get_essential_item_snapshots_skips_query_for_empty_ids():
    db = _FakeDb()

    assert await essential_item_repo.get_essential_item_snapshots(db, []) == {}
    assert db.calls == []
