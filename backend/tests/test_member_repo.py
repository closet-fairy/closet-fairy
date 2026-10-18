"""회원·세션 리포지토리 테스트. DB는 가짜로 바꿔 끼운다."""

from app.repositories import auth_session as session_repo
from app.repositories import member as member_repo


class _Result:
    lastrowid = 42

    def first(self):
        return None


class _FakeDb:
    def __init__(self):
        self.params = []

    async def execute(self, stmt, params):
        self.params.append(params)
        return _Result()


async def test_binary_values_are_bound_as_hex_text():
    db = _FakeDb()

    await member_repo.find_member_by_provider(db, "google", b"\x00\xff")
    await member_repo.insert_member(db, "google", b"\x01\x02", b"\xab", "닉")
    await session_repo.insert_session(db, 42, b"\xcd", 30)

    bound = [value for params in db.params for value in params.values()]
    assert not any(isinstance(value, bytes) for value in bound)
    assert db.params[0]["provider_user_id_hash"] == "00ff"
    assert db.params[1]["provider_user_id_enc"] == "0102"
    assert db.params[-1]["session_token_hash"] == "cd"


async def test_sign_up_creates_setting_and_preference_rows():
    db = _FakeDb()

    member_id = await member_repo.insert_member(db, "google", b"\x01", b"\x02", "닉")

    assert member_id == 42
    assert db.params[1:] == [{"member_id": 42}, {"member_id": 42}]
