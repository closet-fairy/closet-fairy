"""추천 세션 리포지토리 테스트."""

from app.repositories import recommendation_session as session_repo


class _FakeDb:
    def __init__(self):
        self.executed = []
        self.committed = False

    async def execute(self, statement, params):
        self.executed.append((str(statement), params))

    async def commit(self):
        self.committed = True


async def test_update_clothing_shortage_sets_flag_and_commits():
    db = _FakeDb()

    await session_repo.update_clothing_shortage(db, 7, True)

    sql, params = db.executed[0]
    assert "UPDATE recommendation_session" in sql
    assert params == {"recommendation_session_id": 7, "is_clothing_shortage": True}
    assert db.committed
