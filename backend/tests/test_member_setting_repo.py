"""개인 설정 리포지토리 테스트. DB는 가짜로 바꿔 끼운다."""

from types import SimpleNamespace

import pytest

from app.repositories import member_setting as setting_repo


class _Result:
    def __init__(self, row=None, rowcount=0):
        self._row = row
        self.rowcount = rowcount

    def first(self):
        return self._row


class _FakeDb:
    def __init__(self, row=None, rowcount=0):
        self.result = _Result(row, rowcount)
        self.executed = []

    async def execute(self, statement, params):
        self.executed.append((statement, params))
        return self.result


@pytest.mark.parametrize(("flag", "expected"), [(1, True), (0, False)])
async def test_setting_detail_maps_row(flag, expected):
    db = _FakeDb(
        SimpleNamespace(
            member_setting_id=70,
            birth_year=1999,
            temperature_sensitivity_cd=None,
            gender_cd="unisex",
            is_onboarded=flag,
        )
    )

    detail = await setting_repo.find_setting_detail(db, 7)

    assert detail == setting_repo.MemberSettingDetail(70, 1999, None, "unisex", expected)
    assert db.executed == [(setting_repo.SELECT_SETTING_DETAIL_SQL, {"member_id": 7})]


async def test_missing_setting_is_none():
    assert await setting_repo.find_setting_detail(_FakeDb(), 7) is None


async def test_update_setting_binds_all_fields():
    db = _FakeDb()

    await setting_repo.update_setting(db, 70, 1999, "cold_sensitive", "female")

    statement, params = db.executed[0]
    assert statement is setting_repo.UPDATE_SETTING_SQL
    assert "COALESCE(onboarded_at, UTC_TIMESTAMP())" in str(statement)
    assert params == {
        "member_setting_id": 70,
        "birth_year": 1999,
        "temperature_sensitivity_cd": "cold_sensitive",
        "gender_cd": "female",
    }


async def test_replace_styles_deletes_then_inserts_each_style():
    db = _FakeDb()

    await setting_repo.replace_styles(db, 70, ["minimal", "chic"])

    assert db.executed == [
        (setting_repo.DELETE_STYLES_SQL, {"member_setting_id": 70}),
        (
            setting_repo.INSERT_STYLE_SQL,
            [
                {"member_setting_id": 70, "style_cd": "minimal"},
                {"member_setting_id": 70, "style_cd": "chic"},
            ],
        ),
    ]


async def test_replace_styles_with_none_only_deletes():
    db = _FakeDb()

    await setting_repo.replace_styles(db, 70, [])

    assert db.executed == [(setting_repo.DELETE_STYLES_SQL, {"member_setting_id": 70})]


@pytest.mark.parametrize(("rowcount", "claimed"), [(1, True), (0, False)])
async def test_style_bonus_is_claimed_only_when_row_changes(rowcount, claimed):
    db = _FakeDb(rowcount=rowcount)

    assert await setting_repo.claim_style_bonus(db, 70) is claimed
    statement, params = db.executed[0]
    assert "initial_style_bonus_at IS NULL" in str(statement)
    assert params == {"member_setting_id": 70}


async def test_preferred_styles_follow_style_display_order():
    class _Rows:
        def all(self):
            return [SimpleNamespace(style_cd="minimal"), SimpleNamespace(style_cd="chic")]

    class _Db:
        async def execute(self, statement, params):
            self.statement, self.params = statement, params
            return _Rows()

    db = _Db()

    assert await setting_repo.get_preferred_styles(db, 70) == ["minimal", "chic"]
    assert "ORDER BY s.display_seq" in str(db.statement)
    assert db.params == {"member_setting_id": 70}
