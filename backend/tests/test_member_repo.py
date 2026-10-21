"""회원·세션 리포지토리 테스트. DB는 가짜로 바꿔 끼운다."""

from datetime import datetime
from types import SimpleNamespace

import pytest

from app.repositories import auth_session as session_repo
from app.repositories import member as member_repo


class _Result:
    lastrowid = 42

    def __init__(self, row=None):
        self._row = row

    def first(self):
        return self._row


class _FakeDb:
    def __init__(self, row=None):
        self.row = row
        self.statements = []
        self.params = []

    async def execute(self, stmt, params):
        self.statements.append(stmt)
        self.params.append(params)
        return _Result(self.row)


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


async def test_session_lookup_and_revoke_bind_hash_as_hex():
    db = _FakeDb()

    await session_repo.find_active_session_member(db, b"\xab\xcd")
    await session_repo.revoke_session(db, b"\x01")

    assert db.params == [{"session_token_hash": "abcd"}, {"session_token_hash": "01"}]


@pytest.mark.parametrize(("flag", "expected"), [(1, True), (0, False)])
async def test_member_profile_maps_row(flag, expected):
    created_at = datetime(2026, 10, 21, 16, 50)
    db = _FakeDb(
        SimpleNamespace(
            nickname="은석", provider_cd="kakao", created_at=created_at, is_onboarded=flag
        )
    )

    profile = await member_repo.find_member_profile(db, 7)

    assert profile == member_repo.MemberProfile("은석", "kakao", created_at, expected)
    assert db.statements == [member_repo.FIND_MEMBER_PROFILE_SQL]
    assert db.params == [{"member_id": 7}]


async def test_missing_member_profile_is_none():
    assert await member_repo.find_member_profile(_FakeDb(), 7) is None


async def test_update_nickname_binds_member_and_nickname():
    db = _FakeDb()

    await member_repo.update_nickname(db, 7, "새 닉네임")

    assert db.statements == [member_repo.UPDATE_NICKNAME_SQL]
    assert db.params == [{"member_id": 7, "nickname": "새 닉네임"}]
