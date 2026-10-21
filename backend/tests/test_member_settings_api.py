"""개인 설정·온보딩 API 테스트. 리포지토리는 가짜로 바꿔 끼운다."""

from datetime import datetime
from decimal import Decimal
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from app.api.deps import get_current_member_id, get_now
from app.core.db import get_db
from app.main import app
from app.repositories import member_setting as setting_repo
from app.repositories import preference_score as score_repo
from app.repositories.member_setting import MemberSettingDetail
from app.services.weather.base_time import KST

MEMBER_ID = 7
SETTING_ID = 70
NOW = datetime(2026, 10, 22, 2, 0, tzinfo=KST)


class _Transaction:
    async def __aenter__(self):
        return None

    async def __aexit__(self, *exc):
        return False


class _FakeDb:
    def begin(self):
        return _Transaction()


@pytest.fixture
def client(monkeypatch):
    r = SimpleNamespace(
        exists=True,
        birth_year=None,
        temperature_sensitivity_cd=None,
        gender_cd="unisex",
        style_cds=[],
        onboarded=False,
        bonus_claimed=False,
        locked=[],
        bonuses=[],
    )

    async def find_setting_detail(db, member_id):
        assert member_id == MEMBER_ID
        if not r.exists:
            return None
        return MemberSettingDetail(
            SETTING_ID, r.birth_year, r.temperature_sensitivity_cd, r.gender_cd, r.onboarded
        )

    async def get_preferred_styles(db, member_setting_id):
        return list(r.style_cds)

    async def update_setting(db, member_setting_id, birth_year, temperature, gender):
        assert member_setting_id == SETTING_ID
        r.birth_year, r.temperature_sensitivity_cd, r.gender_cd = birth_year, temperature, gender
        r.onboarded = True

    async def replace_styles(db, member_setting_id, style_cds):
        r.style_cds = list(style_cds)

    async def claim_style_bonus(db, member_setting_id):
        if r.bonus_claimed:
            return False
        r.bonus_claimed = True
        return True

    async def lock_member_scores(db, member_id):
        r.locked.append(member_id)
        return []

    async def add_style_bonus(db, member_id, style_cds, bonus, max_score):
        r.bonuses.append((member_id, list(style_cds), bonus, max_score))

    for name, fn in [
        ("find_setting_detail", find_setting_detail),
        ("get_preferred_styles", get_preferred_styles),
        ("update_setting", update_setting),
        ("replace_styles", replace_styles),
        ("claim_style_bonus", claim_style_bonus),
    ]:
        monkeypatch.setattr(setting_repo, name, fn)
    monkeypatch.setattr(score_repo, "lock_member_scores", lock_member_scores)
    monkeypatch.setattr(score_repo, "add_style_bonus", add_style_bonus)

    async def fake_db():
        yield _FakeDb()

    app.dependency_overrides[get_db] = fake_db
    app.dependency_overrides[get_current_member_id] = lambda: MEMBER_ID
    app.dependency_overrides[get_now] = lambda: NOW
    with TestClient(app) as c:
        c.repo = r
        yield c
    app.dependency_overrides.clear()


def test_settings_before_onboarding_are_empty(client):
    res = client.get("/members/me/settings")

    assert res.status_code == 200
    assert res.json() == {
        "birth_year": None,
        "temperature_sensitivity_cd": None,
        "gender_cd": "unisex",
        "style_cds": [],
        "is_onboarded": False,
    }


def test_birth_year_alone_completes_onboarding(client):
    res = client.put("/members/me/settings", json={"birth_year": 1999})

    assert res.status_code == 200
    assert res.json() == {
        "birth_year": 1999,
        "temperature_sensitivity_cd": None,
        "gender_cd": "unisex",
        "style_cds": [],
        "is_onboarded": True,
    }
    assert client.repo.bonuses == []


def test_all_fields_are_saved(client):
    res = client.put(
        "/members/me/settings",
        json={
            "birth_year": 2000,
            "temperature_sensitivity_cd": "cold_sensitive",
            "gender_cd": "female",
            "style_cds": ["minimal", "chic"],
        },
    )

    body = res.json()
    assert (body["temperature_sensitivity_cd"], body["gender_cd"]) == ("cold_sensitive", "female")
    assert body["style_cds"] == ["minimal", "chic"]


def test_omitted_optional_fields_are_cleared(client):
    client.put(
        "/members/me/settings",
        json={"birth_year": 2000, "temperature_sensitivity_cd": "normal", "gender_cd": "male"},
    )

    res = client.put("/members/me/settings", json={"birth_year": 2000, "gender_cd": None})

    assert res.json()["temperature_sensitivity_cd"] is None
    assert res.json()["gender_cd"] == "unisex"


@pytest.mark.parametrize("birth_year", [2012, 2026, 2030], ids=["boundary", "this-year", "future"])
def test_under_14_is_rejected(client, birth_year):
    res = client.put("/members/me/settings", json={"birth_year": birth_year})

    assert res.status_code == 422
    assert res.json() == {
        "code": "VALIDATION_ERROR",
        "message": "만 14세 이상만 이용할 수 있습니다.",
    }
    assert client.repo.birth_year is None


@pytest.mark.parametrize("birth_year", [2011, 1900], ids=["youngest-allowed", "old"])
def test_14_or_older_is_accepted(client, birth_year):
    res = client.put("/members/me/settings", json={"birth_year": birth_year})

    assert res.status_code == 200


@pytest.mark.parametrize(
    "body",
    [
        {},
        {"birth_year": None},
        {"birth_year": 0},
        {"birth_year": 2000, "gender_cd": "other"},
        {"birth_year": 2000, "temperature_sensitivity_cd": "hot"},
        {"birth_year": 2000, "style_cds": ["goth"]},
        {"birth_year": 2000, "member_id": 1},
    ],
    ids=["missing", "null", "zero", "gender", "temperature", "style", "extra-field"],
)
def test_malformed_settings_are_422(client, body):
    res = client.put("/members/me/settings", json=body)

    assert res.status_code == 422
    assert client.repo.birth_year is None


def test_first_styles_get_bonus_once(client):
    res = client.put(
        "/members/me/settings",
        json={"birth_year": 1999, "style_cds": ["casual", "street", "casual"]},
    )

    assert res.json()["style_cds"] == ["casual", "street"]
    assert client.repo.locked == [MEMBER_ID]
    assert client.repo.bonuses == [
        (MEMBER_ID, ["casual", "street"], Decimal("5.00"), Decimal("60.00"))
    ]

    client.put("/members/me/settings", json={"birth_year": 1999, "style_cds": ["chic"]})

    assert len(client.repo.bonuses) == 1


def test_bonus_waits_until_styles_are_first_chosen(client):
    client.put("/members/me/settings", json={"birth_year": 1999})
    client.put("/members/me/settings", json={"birth_year": 1999, "style_cds": ["vintage"]})

    assert client.repo.bonuses == [(MEMBER_ID, ["vintage"], Decimal("5.00"), Decimal("60.00"))]


def test_member_gone_after_login_is_401(client):
    client.repo.exists = False

    assert client.get("/members/me/settings").status_code == 401
    assert client.put("/members/me/settings", json={"birth_year": 1999}).status_code == 401


@pytest.mark.parametrize("method", ["GET", "PUT"])
def test_settings_need_login(method):
    with TestClient(app) as c:
        res = c.request(method, "/members/me/settings", json={"birth_year": 1999})

    assert res.status_code == 401
    assert res.json()["code"] == "AUTH_REQUIRED"
