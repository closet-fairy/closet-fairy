"""REC-09 essential_item 리포지토리 단위 테스트."""

from app.repositories import essential_item as essential_item_repo


class _FakeResult:
    def all(self):
        return []


class _FakeDb:
    def __init__(self):
        self.calls: list[dict] = []

    async def execute(self, stmt, params):
        self.calls.append(params)
        return _FakeResult()


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
