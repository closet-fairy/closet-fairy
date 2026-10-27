"""재추천 E2E 스크립트의 판정·비교 함수 테스트. 서버·DB·LLM은 쓰지 않는다."""

import re
from datetime import datetime
from types import SimpleNamespace

import httpx
import pytest

from app.services.input_guard import is_harmful
from app.services.weather.base_time import KST
from scripts.recommendation_e2e import MEMBERS
from scripts.regeneration_e2e import (
    EXPECTED_FAILED,
    FAIL,
    FORMAL_TEXT,
    HARMFUL_TEXT,
    NOT_APPLICABLE,
    PASS,
    PLANS,
    RIGHT_AFTER_PREVIOUS,
    UNCLEAR_TEXT,
    UNCONFIRMED,
    Context,
    RequestIds,
    SessionPlan,
    SessionState,
    Step,
    avoided_in_exploratory,
    compare_parts,
    end_during_verdict,
    error_failures,
    judge,
    pick_target,
    regeneration_status,
    repeated_combos,
    run_session,
    screen_record,
    too_long_text,
)

REQUEST_ID = re.compile(r"e2e89-[a-z]+-[A-Za-z0-9]+-[A-Za-z0-9_]+-\d{8}T\d{6}-\d+")


def test_request_ids_do_not_repeat_within_a_run():
    ids = RequestIds("dev", datetime(2026, 10, 28, 1, 2, 3, tzinfo=KST))

    issued = [ids.new(session, step) for session in ("D1", "D2") for step in ("start", "R1")]
    issued += [ids.new("D1", "R1") for _ in range(20)]

    assert len(set(issued)) == len(issued)
    assert all(rid.isascii() and REQUEST_ID.fullmatch(rid) for rid in issued)
    assert issued[0] == "e2e89-dev-D1-start-20261028T010203-1"


def _result(seq: int | None, status: str | None) -> dict:
    latest = None if seq is None else {"request_seq": seq, "regeneration_status_cd": status}
    return {"latest_regeneration": latest}


@pytest.mark.parametrize(
    ("data", "expected"),
    [
        (_result(None, None), None),
        (_result(1, "completed"), None),
        (_result(2, "processing"), None),
        (_result(2, "completed"), "completed"),
        (_result(2, "failed"), "failed"),
    ],
)
def test_polling_stops_only_on_finished_status_of_same_request(data, expected):
    assert regeneration_status(data, request_seq=2) == expected


BEFORE = [("top", "o1"), ("bottom", "o2"), ("shoes", "o3"), ("accessories", "o9")]


def test_parts_swap_keeps_other_slots():
    after = [("top", "o1"), ("bottom", "o2"), ("shoes", "e7"), ("accessories", "o9")]

    assert compare_parts(BEFORE, after, {"shoes"}) == ([], False)


def test_parts_swap_fails_when_other_slot_changes():
    after = [("top", "o5"), ("bottom", "o2"), ("shoes", "e7"), ("accessories", "o9")]

    failures, _ = compare_parts(BEFORE, after, {"shoes"})

    assert failures == ["그대로 둘 top이 바뀜"]


def test_parts_swap_fails_when_target_slot_is_unchanged():
    failures, _ = compare_parts(BEFORE, list(BEFORE), {"shoes"})

    assert failures == ["바꿀 shoes이 그대로"]


def test_outer_added_to_set_without_outer_is_allowed_and_recorded():
    after = [("outer", "e1"), ("top", "o1"), ("bottom", "o2"), ("shoes", "e7")]
    before = BEFORE[:3]

    assert compare_parts(before, after, {"shoes"}) == ([], True)


def test_changed_outer_is_not_treated_as_added():
    before = [("outer", "o4"), *BEFORE[:3]]
    after = [("outer", "e1"), ("top", "o1"), ("bottom", "o2"), ("shoes", "e7")]

    failures, outer_added = compare_parts(before, after, {"shoes"})

    assert failures == ["그대로 둘 outer이 바뀜"]
    assert outer_added is False


def test_repeated_combo_is_reported():
    before = [frozenset({"o1", "o2", "o3"}), frozenset({"o1", "o2", "e3"})]
    after = [frozenset({"o1", "o2", "e3"}), frozenset({"o5", "o2", "o3"})]

    assert repeated_combos(before, after) == ["이전 코디와 같은 조합"]


def _outfit(outfit_type: str, styles: list[list[str]]) -> dict:
    return {"outfit_type_cd": outfit_type, "items": [{"style_cds": s} for s in styles]}


def test_avoided_style_only_matters_in_exploratory_outfit():
    outfits = [
        _outfit("preferred", [["casual"], ["street"]]),
        _outfit("exploratory", [["minimal"], ["casual", "classic"]]),
    ]

    assert avoided_in_exploratory(outfits, ["casual"]) == ["탐색 코디에 기피 스타일 casual"]
    assert avoided_in_exploratory(outfits, ["street"]) == []


@pytest.mark.parametrize(
    ("status", "body", "matched"),
    [
        (422, {"code": "REGENERATION_REQUEST_UNCLEAR"}, True),
        (422, {"code": "REGENERATION_REQUEST_HARMFUL"}, False),
        (409, {"code": "REGENERATION_REQUEST_UNCLEAR"}, False),
        (202, {"regeneration_request_id": 1}, False),
        (None, None, False),
    ],
)
def test_rejection_must_match_status_and_code(status, body, matched):
    failures = error_failures(status, body, "422 REGENERATION_REQUEST_UNCLEAR")

    assert (failures == []) is matched


@pytest.mark.parametrize(
    ("expected", "final_status", "failures", "verdict"),
    [
        ("completed", "completed", [], PASS),
        ("failed", "failed", [], EXPECTED_FAILED),
        ("completed", "failed", [], FAIL),
        ("failed", "completed", [], FAIL),
        ("completed", "processing", [], FAIL),
        ("completed", "completed", ["없는 item_id"], FAIL),
    ],
)
def test_judge(expected, final_status, failures, verdict):
    assert judge(expected, final_status, list(failures)) == verdict


def test_unexpected_status_is_explained():
    failures: list[str] = []

    judge("failed", "completed", failures)

    assert failures == ["상태 completed (기대 failed)"]


@pytest.mark.parametrize(
    ("end_event", "has_server_log", "verdict"),
    [
        ({"event": "regeneration.discarded"}, True, PASS),
        ({"event": "regeneration.completed"}, True, NOT_APPLICABLE),
        ({"event": "regeneration.failed"}, True, NOT_APPLICABLE),
        (None, False, UNCONFIRMED),
        (None, True, FAIL),
    ],
)
def test_end_during_verdict(end_event, has_server_log, verdict):
    assert end_during_verdict(end_event, has_server_log) == verdict


def test_too_long_text_survives_server_strip():
    text = too_long_text(300)

    assert len(text) == 301
    assert text.strip() == text


def _state(outfits: list[dict], target_seq_by_step: dict[str, int] | None = None) -> SessionState:
    return SessionState(
        SessionPlan("D1", "daily", ()),
        1,
        {"outfits": outfits},
        dict(target_seq_by_step or {}),
    )


def _current(outfit_id: int, seq: int, previous: list[int] = ()) -> dict:
    return {
        "outfit_id": outfit_id,
        "outfit_seq": seq,
        "previous_outfits": [{"outfit_id": p} for p in previous],
    }


def test_pick_target_from_current_or_previous_outfits():
    state = _state([_current(10, 1), _current(20, 2, previous=[12, 11])], {"R2": 2})

    assert pick_target(state, None) == (None, None, None)
    assert pick_target(state, "current:1") == (20, 2, None)
    assert pick_target(state, "current:3") == (20, 2, None)
    assert pick_target(state, "previous_of:R2") == (12, 2, None)


@pytest.mark.parametrize(
    ("outfits", "target", "reason"),
    [
        ([], "current:0", "화면에 코디가 없음"),
        ([_current(10, 1)], "previous_of:R2", "R2의 이전 코디가 없음"),
    ],
)
def test_pick_target_reports_instead_of_raising(outfits, target, reason):
    assert pick_target(_state(outfits, {"R2": 1}), target) == (None, None, reason)


def test_exception_texts_reach_intended_check():
    assert is_harmful(HARMFUL_TEXT)
    assert not is_harmful(UNCLEAR_TEXT)


class _Response:
    def __init__(self, status: int, body: dict, request_id: str) -> None:
        self.status_code = status
        self._body = body
        self.headers = {"x-request-id": request_id}

    def json(self) -> dict:
        return self._body


class _DownClient:
    """POST는 받지만 결과 조회 GET은 연결 오류를 내는 서버."""

    timeout = 10.0

    def __init__(self) -> None:
        self.posts: list[str] = []

    async def post(self, url, json=None, headers=None, timeout=None):
        self.posts.append(url)
        request_id = headers["X-Request-ID"]
        if url.endswith("/regenerations"):
            if json["request_text"] == UNCLEAR_TEXT:
                return _Response(422, {"code": "REGENERATION_REQUEST_UNCLEAR"}, request_id)
            return _Response(202, {"regeneration_request_id": 9, "request_seq": 1}, request_id)
        return _Response(200, {}, request_id)

    async def get(self, url):
        raise httpx.ConnectError("down")


FIRST_RESULT = {
    "generation_status_cd": "completed",
    "outfits": [{"outfit_id": 11, "outfit_seq": 1, "previous_outfits": []}],
}


@pytest.fixture
def down_server(monkeypatch):
    session_ids = iter(range(1, 10))

    async def start_session(client, scenario, member, member_id, args, request_id=None):
        run = {"recommendation_session_id": next(session_ids), "request_id": request_id}
        return {**run, "request_id_echoed": request_id}, 0.0

    async def inspect_session(client, run, started, member, member_id):
        return {**run, "generation_status_cd": "completed"}, [], FIRST_RESULT

    async def outfit_items(outfit_ids):
        return {oid: [("top", "o1")] for oid in outfit_ids}

    async def session_decks(session_id):
        return []

    async def request_count(session_id):
        return 0

    for name, fake in {
        "start_session": start_session,
        "inspect_session": inspect_session,
        "outfit_items": outfit_items,
        "session_decks": session_decks,
        "request_count": request_count,
    }.items():
        monkeypatch.setattr(f"scripts.regeneration_e2e.{name}", fake)
    client = _DownClient()
    ctx = Context(client, RequestIds("dev", datetime.now(KST)), MEMBERS["dev"], 3, "dev", None)
    return ctx, client


ARGS = SimpleNamespace(date="today")


async def test_get_error_fails_step_skips_rest_and_moves_to_next_session(down_server):
    ctx, client = down_server
    first = SessionPlan(
        "D1",
        "daily",
        (
            Step("R1", "all", FORMAL_TEXT, scope="all"),
            Step("R2", "single", FORMAL_TEXT, target="current:0"),
            Step("cancel", "cancel"),
        ),
    )
    second = SessionPlan(
        "D2",
        "work",
        (
            Step(
                "X3",
                "unclear",
                UNCLEAR_TEXT,
                scope="all",
                expected="422 REGENERATION_REQUEST_UNCLEAR",
            ),
        ),
    )

    await run_session(ctx, first, ARGS)
    await run_session(ctx, second, ARGS)

    by_step = {(r["session"], r["step"]): r for r in ctx.records}
    assert by_step["D1", "R1"]["verdict"] == FAIL
    assert by_step["D1", "R1"]["failures"] == ["GET 오류 (ConnectError)"]
    assert by_step["D1", "R1"]["regeneration_request_id"] == 9
    assert by_step["D1", "R2"]["failures"] == ["앞 회차 GET 오류"]
    assert by_step["D1", "cancel"]["failures"] == ["앞 회차 GET 오류"]
    assert by_step["D2", "X3"]["verdict"] == PASS
    assert client.posts.count("/recommendation-sessions/1/cancel") == 1
    assert [r["ended_by"] for r in ctx.runs] == ["cancel", "cancel"]


def test_screen_record_lists_items_per_outfit():
    outfits = [{"outfit_id": 21, "outfit_seq": 1}, {"outfit_id": 24, "outfit_seq": 4}]
    items = {21: [("top", "o165"), ("outer", "e7")], 24: []}

    assert screen_record(outfits, items) == [
        {"outfit_seq": 1, "outfit_id": 21, "item_keys": ["e7", "o165"]},
        {"outfit_seq": 4, "outfit_id": 24, "item_keys": []},
    ]


async def test_screen_before_is_recorded_even_if_regeneration_does_not_finish(down_server):
    ctx, _ = down_server
    plan = SessionPlan("D1", "daily", (Step("R1", "all", FORMAL_TEXT, scope="all"),))

    await run_session(ctx, plan, ARGS)

    assert ctx.records[0]["screen_before"] == [
        {"outfit_seq": 1, "outfit_id": 11, "item_keys": ["o1"]}
    ]


async def test_first_result_get_error_skips_session_and_cancels(down_server, monkeypatch):
    ctx, client = down_server

    async def inspect_session(client, run, started, member, member_id):
        raise httpx.ReadTimeout("slow")

    monkeypatch.setattr("scripts.regeneration_e2e.inspect_session", inspect_session)
    plan = SessionPlan("D1", "daily", (Step("R1", "all", FORMAL_TEXT, scope="all"),))

    run = await run_session(ctx, plan, ARGS)

    assert run["passed"] is False
    assert run["failures"] == ["GET 오류 (ReadTimeout)"]
    assert ctx.records[0]["failures"] == ["앞 회차 GET 오류"]
    assert client.posts == ["/recommendation-sessions/1/cancel"]


async def test_run_is_kept_for_json_even_if_session_stops_midway(down_server, monkeypatch):
    ctx, _ = down_server

    async def inspect_session(client, run, started, member, member_id):
        raise RuntimeError("unexpected")

    monkeypatch.setattr("scripts.regeneration_e2e.inspect_session", inspect_session)
    plan = SessionPlan("D1", "daily", (Step("R1", "all", FORMAL_TEXT, scope="all"),))

    with pytest.raises(RuntimeError):
        await run_session(ctx, plan, ARGS)

    assert [r["recommendation_session_id"] for r in ctx.runs] == [1]


@pytest.mark.parametrize("member_key", list(PLANS))
def test_plans_are_consistent(member_key):
    for plan in PLANS[member_key]:
        names = [s.name for s in plan.steps]
        assert len(names) == len(set(names))
        for i, step in enumerate(plan.steps):
            if step.kind in RIGHT_AFTER_PREVIOUS:
                assert plan.steps[i - 1].kind in ("all", "single", "parts")
            if step.expected not in ("completed",):
                assert step.intentional, step.name
