"""재추천 결과 저장·정산·정리 검증 스크립트 (#87). 실제 MySQL에 붙고 LLM은 호출하지 않는다.

검증용 회원·옷·세션·첫 덱(1번 선호, 2번 탐색)을 SQL로 직접 넣고 서비스 함수를 호출한다.
코디 생성(regenerate_outfits)만 정해 둔 결과를 돌려주는 가짜로 바꾸고,
요청 복원과 저장은 실제 코드다.
  (a) 2번 세트 재추천 → 새 덱(deck_seq 2, regeneration)에 2번 코디 1행,
      요청 completed + result_deck_id
  (b) 그 뒤 1번에 별점 → 대상 코디는 regeneration_requested(-0.5), 새 코디는 auto_rejected,
      선호 점수가 순차 계산과 일치, 정리 뒤 재추천 요청 0행
  (c) single 완료 뒤 all 요청(failed) → all 대상(화면의 최신 코디)도 -0.5, 정리 뒤 요청 0행
  (d) 생성 0벌 → 요청 failed, 덱을 만들지 않음
  (e) 생성 중 시간 초과로 failed된 요청 → 결과를 버리고 덱을 만들지 않음
  (f) 생성 중 별점 → 결과를 버리고 정리 뒤 요청 0행
  (g) 취소·이탈 뒤 재추천 요청(single·all) 0행
  (h) 앞 요청이 completed면 다음 요청 복원 의도에 합쳐지고 failed면 빠짐
  (i) 저장과 별점을 N쌍 동시에 → 교착·예외 없음, 세션 completed, 요청 0행, S·N이 순차 계산과 일치
  (j) 저장과 취소를 N쌍 동시에 → 교착·예외 없음, 세션 canceled, 덱·요청 0행
끝나면 검증용 회원을 지운다(FK CASCADE). 개발 회원 데이터는 건드리지 않는다.

backend/ 폴더에서 실행한다 (docker DB와 마이그레이션·시드가 준비돼 있어야 한다):
    python scripts/regeneration_save_check.py
    python scripts/regeneration_save_check.py --pairs 20 --keep
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import text  # noqa: E402
from sqlalchemy.ext.asyncio import (  # noqa: E402
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import get_settings  # noqa: E402
from app.core.db import engine as app_engine  # noqa: E402
from app.repositories import regeneration_request as regeneration_repo  # noqa: E402
from app.services import rating_settlement as settlement  # noqa: E402
from app.services import (  # noqa: E402
    regeneration_generation,
    regeneration_pipeline,
    regeneration_save,
    session_cleanup,
    session_end,
)
from app.services.essential_supplement import (  # noqa: E402
    SupplementedCandidate,
    SupplementResult,
)
from app.services.outfit_generator import DraftOutfit, GenerationResult  # noqa: E402
from app.services.recommendation_session import to_db_utc  # noqa: E402
from app.services.regeneration_generation import RegenerationOutcome  # noqa: E402
from app.services.regeneration_intent import RegenerationIntent  # noqa: E402
from app.services.weather.base_time import KST  # noqa: E402
from scripts.session_cleanup_check import expect, insert_weather  # noqa: E402
from scripts.settlement_concurrency import (  # noqa: E402
    Wardrobe,
    apply_sequentially,
    cleanup,
    compare_scores,
    create_member,
    create_wardrobe,
    insert_deck,
    insert_outfit,
    read_scores,
    report,
    warm_up_pool,
)

RATING = 4
CASUAL = RegenerationIntent(status="ok", preferred_styles=("casual",))
WARMER = RegenerationIntent(status="ok", clothing_warmth="warmer")
LIGHTER = RegenerationIntent(status="ok", clothing_warmth="lighter")


@dataclass(frozen=True)
class Seeded:
    session_id: int
    first_deck_id: int
    outfit1: int
    outfit2: int


async def seed_member(factory, member_ids: list[int]) -> tuple[int, Wardrobe]:
    async with factory() as db, db.begin():
        member_id = await create_member(db)
        member_ids.append(member_id)
        wardrobe = await create_wardrobe(db, member_id)
    return member_id, wardrobe


async def seed_session(factory, member_id: int, w: Wardrobe) -> Seeded:
    now = datetime.now(timezone.utc).replace(tzinfo=None, microsecond=0)
    start = now + timedelta(hours=1)
    async with factory() as db, db.begin():
        result = await db.execute(
            text(
                """
                INSERT INTO recommendation_session (
                    member_id, sido_nm, sigungu_nm, location_input_type_cd, tpo_cd,
                    tpo_input_type_cd, going_out_start_at, going_out_end_at, season_cd,
                    generation_status_cd
                ) VALUES (
                    :m, '서울특별시', '성동구', 'manual', 'daily',
                    'preset', :start, :end, 'fall', 'completed'
                )
                """
            ),
            {"m": member_id, "start": start, "end": start + timedelta(hours=3)},
        )
        session_id = int(result.lastrowid)
        await insert_weather(db, session_id)
        deck_id = await insert_deck(db, session_id, 1, "initial")
        outfit1 = await insert_outfit(
            db,
            deck_id,
            1,
            "preferred",
            [
                ("top", "owned", w.top_minimal_black),
                ("bottom", "owned", w.bottom_casual_navy),
                ("shoes", "essential", w.essential_shoes),
            ],
        )
        outfit2 = await insert_outfit(
            db,
            deck_id,
            2,
            "exploratory",
            [
                ("top", "owned", w.top_street_white),
                ("bottom", "owned", w.bottom_classic_no_color),
                ("shoes", "essential", w.essential_shoes),
            ],
        )
    return Seeded(session_id, deck_id, outfit1, outfit2)


async def insert_request(
    factory,
    session_id: int,
    seq: int,
    scope: str,
    target_outfit_id: int | None,
    intent: RegenerationIntent,
    status: str = "processing",
) -> int:
    async with factory() as db, db.begin():
        result = await db.execute(
            text(
                """
                INSERT INTO regeneration_request (recommendation_session_id, request_seq,
                    target_scope_cd, target_outfit_id, request_text, parsed_intent,
                    regeneration_status_cd)
                VALUES (:s, :seq, :scope, :o, '재추천 검증', :intent, :status)
                """
            ),
            {
                "s": session_id,
                "seq": seq,
                "scope": scope,
                "o": target_outfit_id,
                "intent": json.dumps(intent.to_dict()),
                "status": status,
            },
        )
    return int(result.lastrowid)


async def insert_second_outfit_request(factory, seeded: Seeded) -> int:
    return await insert_request(factory, seeded.session_id, 1, "single", seeded.outfit2, CASUAL)


def candidate(item_id: int, category_cd: str, source_cd: str = "owned") -> SupplementedCandidate:
    return SupplementedCandidate(
        item_id=item_id,
        source_cd=source_cd,
        category_cd=category_cd,
        accessory_type_cd=None,
        item_name="재추천 검증 옷",
        color_cd=None,
        styles=[],
        thickness_cd=None,
        is_waterproof=False,
        seasons=[],
    )


def supplement_of(w: Wardrobe) -> SupplementResult:
    return SupplementResult(
        candidates=[
            candidate(w.top_minimal_black, "top"),
            candidate(w.top_street_white, "top"),
            candidate(w.bottom_casual_navy, "bottom"),
            candidate(w.bottom_classic_no_color, "bottom"),
            candidate(w.essential_shoes, "shoes", "essential"),
        ],
        is_clothing_shortage=False,
        outer_requirement="optional",
    )


def new_second_outfit(w: Wardrobe) -> DraftOutfit:
    return DraftOutfit(
        2,
        "preferred",
        (f"o{w.top_street_white}", f"o{w.bottom_casual_navy}", f"e{w.essential_shoes}"),
        "재추천 검증",
    )


def outcome_of(w: Wardrobe, outfits: list[DraftOutfit]) -> RegenerationOutcome:
    generation = GenerationResult(
        outfits=outfits,
        rounds=1,
        hard_rule_retries=0,
        reviewer_retries=0,
        shortfall_retries=0,
        fallback_count=0,
    )
    return RegenerationOutcome(generation, supplement_of(w), prompt_input=None)


async def run_pipeline(request_id: int, w: Wardrobe, outfits: list[DraftOutfit], before=None):
    async def fake_regenerate(ctx, llm):
        if before is not None:
            await before()
        return outcome_of(w, outfits)

    original = regeneration_pipeline.regenerate_outfits
    regeneration_pipeline.regenerate_outfits = fake_regenerate
    try:
        await regeneration_pipeline.run_regeneration_pipeline(request_id, llm=None)
    finally:
        regeneration_pipeline.regenerate_outfits = original


async def rate_without_cleanup(factory, session_id: int, member_id: int, outfit_id: int) -> None:
    async def skip_cleanup(db, sid):
        return session_cleanup.NOTHING_DELETED

    original = settlement.cleanup_ended_session
    settlement.cleanup_ended_session = skip_cleanup
    try:
        async with factory() as db:
            await settlement.rate_and_settle(
                db, session_id, member_id, outfit_id, RATING, datetime.now(KST)
            )
    finally:
        settlement.cleanup_ended_session = original


async def rate(factory, session_id: int, member_id: int, outfit_id: int) -> None:
    async with factory() as db:
        await settlement.rate_and_settle(
            db, session_id, member_id, outfit_id, RATING, datetime.now(KST)
        )


async def request_rows(factory, session_id: int) -> list[tuple]:
    async with factory() as db:
        rows = await db.execute(
            text(
                """
                SELECT request_seq, regeneration_status_cd, result_deck_id
                FROM regeneration_request WHERE recommendation_session_id = :s
                ORDER BY request_seq
                """
            ),
            {"s": session_id},
        )
        return [tuple(r) for r in rows]


async def decks(factory, session_id: int) -> list[tuple]:
    async with factory() as db:
        rows = await db.execute(
            text(
                """
                SELECT d.recommendation_deck_id, d.deck_seq, d.deck_trigger_cd,
                       COUNT(o.outfit_id) AS outfit_count
                FROM recommendation_deck d
                LEFT JOIN outfit o ON o.recommendation_deck_id = d.recommendation_deck_id
                WHERE d.recommendation_session_id = :s
                GROUP BY d.recommendation_deck_id, d.deck_seq, d.deck_trigger_cd
                ORDER BY d.deck_seq
                """
            ),
            {"s": session_id},
        )
        return [tuple(r) for r in rows]


async def deck_outfits(factory, deck_id: int) -> list[tuple]:
    async with factory() as db:
        rows = await db.execute(
            text(
                """
                SELECT o.outfit_id, o.outfit_seq, COUNT(i.outfit_item_id) AS item_count
                FROM outfit o JOIN outfit_item i ON i.outfit_id = o.outfit_id
                WHERE o.recommendation_deck_id = :d
                GROUP BY o.outfit_id, o.outfit_seq
                """
            ),
            {"d": deck_id},
        )
        return [tuple(r) for r in rows]


async def feedback_types(factory, session_id: int) -> dict[int, tuple[str, Decimal]]:
    async with factory() as db:
        rows = await db.execute(
            text(
                """
                SELECT outfit_id, feedback_type_cd, applied_delta FROM outfit_feedback
                WHERE recommendation_session_id = :s
                """
            ),
            {"s": session_id},
        )
        return {r.outfit_id: (r.feedback_type_cd, r.applied_delta) for r in rows}


async def session_status(factory, session_id: int) -> str:
    async with factory() as db:
        return (
            await db.execute(
                text(
                    "SELECT session_status_cd FROM recommendation_session "
                    "WHERE recommendation_session_id = :s"
                ),
                {"s": session_id},
            )
        ).scalar_one()


def settlement_deltas(w: Wardrobe, settings) -> dict:
    regeneration = settings.SCORE_DELTA_REGENERATION_REQUESTED
    rated = settlement.rating_delta(RATING, settings)
    deltas = {
        ("style", "street"): regeneration,
        ("color", "white"): regeneration,
        ("style", "classic"): regeneration,
    }
    for key in [
        ("style", "minimal"),
        ("style", "casual"),
        ("color", "black"),
        ("color", "navy"),
        ("style", w.essential_style_cd),
        ("color", w.essential_color_cd),
    ]:
        deltas[key] = rated
    return deltas


async def check_save_and_settle(factory, member_ids: list[int]) -> list[bool]:
    settings = get_settings()
    member_id, w = await seed_member(factory, member_ids)
    seeded = await seed_session(factory, member_id, w)
    request_id = await insert_second_outfit_request(factory, seeded)

    await run_pipeline(request_id, w, [new_second_outfit(w)])

    failures: list[str] = []
    deck_rows = await decks(factory, seeded.session_id)
    expect(
        failures,
        "덱 (seq, 계기, 코디 수)",
        [r[1:] for r in deck_rows],
        [(1, "initial", 2), (2, "regeneration", 1)],
    )
    new_deck_id = deck_rows[-1][0] if len(deck_rows) == 2 else None
    new_outfits = await deck_outfits(factory, new_deck_id) if new_deck_id else []
    expect(failures, "새 덱 코디 (seq, 아이템 수)", [r[1:] for r in new_outfits], [(2, 3)])
    expect(
        failures,
        "요청",
        await request_rows(factory, seeded.session_id),
        [(1, "completed", new_deck_id)],
    )
    ok_a = report("(a) 2번 세트 재추천 → 새 덱에 2번 코디 1행", failures)

    failures = []
    before = await read_scores(factory, member_id)
    await rate_without_cleanup(factory, seeded.session_id, member_id, seeded.outfit1)
    new_outfit_id = new_outfits[0][0] if new_outfits else None
    expect(
        failures,
        "피드백",
        await feedback_types(factory, seeded.session_id),
        {
            seeded.outfit1: ("rated", settlement.rating_delta(RATING, settings)),
            seeded.outfit2: ("regeneration_requested", Decimal("-0.50")),
            new_outfit_id: ("auto_rejected", Decimal("-0.10")),
        },
    )
    expected = apply_sequentially(before, settlement_deltas(w, settings), 1, settings)
    failures += compare_scores(await read_scores(factory, member_id), expected)
    async with factory() as db:
        await session_cleanup.cleanup_ended_session(db, seeded.session_id)
    expect(failures, "정리 뒤 요청", await request_rows(factory, seeded.session_id), [])
    ok_b = report("(b) 재추천 대상 -0.5 정산, 정리 뒤 요청 0행", failures)
    return [ok_a, ok_b]


async def check_all_target(factory, member_ids: list[int]) -> bool:
    settings = get_settings()
    member_id, w = await seed_member(factory, member_ids)
    seeded = await seed_session(factory, member_id, w)
    first = await insert_request(factory, seeded.session_id, 1, "single", seeded.outfit2, CASUAL)
    await run_pipeline(first, w, [new_second_outfit(w)])
    await insert_request(factory, seeded.session_id, 2, "all", None, WARMER, status="failed")
    deck_rows = await decks(factory, seeded.session_id)
    new_outfit_id = (await deck_outfits(factory, deck_rows[-1][0]))[0][0]

    await rate_without_cleanup(factory, seeded.session_id, member_id, seeded.outfit1)

    failures: list[str] = []
    regeneration = ("regeneration_requested", settings.SCORE_DELTA_REGENERATION_REQUESTED)
    expect(
        failures,
        "피드백",
        await feedback_types(factory, seeded.session_id),
        {
            seeded.outfit1: ("rated", settlement.rating_delta(RATING, settings)),
            seeded.outfit2: regeneration,
            new_outfit_id: regeneration,
        },
    )
    async with factory() as db:
        await session_cleanup.cleanup_ended_session(db, seeded.session_id)
    expect(failures, "정리 뒤 요청", await request_rows(factory, seeded.session_id), [])
    return report("(c) all 요청 대상(화면 최신 코디) -0.5, 정리 뒤 요청 0행", failures)


async def check_empty_generation(factory, member_ids: list[int]) -> bool:
    member_id, w = await seed_member(factory, member_ids)
    seeded = await seed_session(factory, member_id, w)
    request_id = await insert_request(factory, seeded.session_id, 1, "all", None, CASUAL)

    await run_pipeline(request_id, w, [])

    failures: list[str] = []
    expect(failures, "요청", await request_rows(factory, seeded.session_id), [(1, "failed", None)])
    expect(failures, "덱 수", len(await decks(factory, seeded.session_id)), 1)
    return report("(d) 0벌 → 요청 failed, 덱 없음", failures)


async def check_timed_out(factory, member_ids: list[int]) -> bool:
    timeout = get_settings().REGENERATION_PROCESSING_TIMEOUT_SECONDS
    member_id, w = await seed_member(factory, member_ids)
    seeded = await seed_session(factory, member_id, w)
    request_id = await insert_second_outfit_request(factory, seeded)

    async def time_out():
        async with factory() as db, db.begin():
            await db.execute(
                text(
                    """
                    UPDATE regeneration_request
                    SET created_at = created_at - INTERVAL :sec SECOND
                    WHERE regeneration_request_id = :r
                    """
                ),
                {"sec": timeout + 1, "r": request_id},
            )
            stale_before = to_db_utc(datetime.now(KST) - timedelta(seconds=timeout))
            await regeneration_repo.fail_stale_processing(db, seeded.session_id, stale_before)

    await run_pipeline(request_id, w, [new_second_outfit(w)], before=time_out)

    failures: list[str] = []
    expect(failures, "요청", await request_rows(factory, seeded.session_id), [(1, "failed", None)])
    expect(failures, "덱 수", len(await decks(factory, seeded.session_id)), 1)
    return report("(e) 시간 초과로 failed된 요청의 결과 버림", failures)


async def check_rating_during_generation(factory, member_ids: list[int]) -> bool:
    member_id, w = await seed_member(factory, member_ids)
    seeded = await seed_session(factory, member_id, w)
    request_id = await insert_second_outfit_request(factory, seeded)

    async def rate_now():
        await rate(factory, seeded.session_id, member_id, seeded.outfit1)

    await run_pipeline(request_id, w, [new_second_outfit(w)], before=rate_now)

    failures: list[str] = []
    expect(failures, "세션 상태", await session_status(factory, seeded.session_id), "completed")
    expect(
        failures,
        "덱 (seq, 계기, 코디 수)",
        [r[1:] for r in await decks(factory, seeded.session_id)],
        [(1, "initial", 1)],
    )
    expect(failures, "요청", await request_rows(factory, seeded.session_id), [])
    return report("(f) 생성 중 별점 → 결과 버림, 요청 0행", failures)


async def check_cancel_and_abandon(factory, member_ids: list[int]) -> bool:
    timeout = get_settings().SESSION_ABANDON_TIMEOUT_MINUTES
    member_id, w = await seed_member(factory, member_ids)
    canceled = await seed_session(factory, member_id, w)
    abandoned = await seed_session(factory, member_id, w)
    for seeded in (canceled, abandoned):
        await insert_request(factory, seeded.session_id, 1, "single", seeded.outfit2, CASUAL)
        await insert_request(factory, seeded.session_id, 2, "all", None, WARMER)

    async with factory() as db:
        await session_end.cancel_session(db, canceled.session_id, member_id, datetime.now(KST))

    async with factory() as db, db.begin():
        for table in ("recommendation_session", "recommendation_deck", "regeneration_request"):
            await db.execute(
                text(
                    f"""
                    UPDATE {table} SET created_at = created_at - INTERVAL :m MINUTE
                    WHERE recommendation_session_id = :s
                    """
                ),
                {"m": timeout + 1, "s": abandoned.session_id},
            )
    now = datetime.now(KST)
    since = to_db_utc(now) - timedelta(minutes=timeout)
    async with factory() as db:
        was_abandoned = await session_end.abandon_if_inactive(db, abandoned.session_id, since, now)

    failures: list[str] = []
    expect(failures, "이탈 처리", was_abandoned, True)
    for seeded, status in ((canceled, "canceled"), (abandoned, "abandoned")):
        expect(failures, f"세션 {status}", await session_status(factory, seeded.session_id), status)
        expect(failures, f"{status} 요청", await request_rows(factory, seeded.session_id), [])
        expect(failures, f"{status} 덱", await decks(factory, seeded.session_id), [])
    return report("(g) 취소·이탈 뒤 요청(single·all) 0행", failures)


async def check_intent_merge(factory, member_ids: list[int]) -> bool:
    member_id, w = await seed_member(factory, member_ids)
    seeded = await seed_session(factory, member_id, w)
    first = await insert_request(factory, seeded.session_id, 1, "single", seeded.outfit2, CASUAL)
    await run_pipeline(first, w, [new_second_outfit(w)])
    second = await insert_request(factory, seeded.session_id, 2, "all", None, WARMER)
    await run_pipeline(second, w, [])
    third = await insert_request(factory, seeded.session_id, 3, "all", None, LIGHTER)

    ctx = await regeneration_generation.load_regeneration_context(third)

    failures: list[str] = []
    expect(
        failures,
        "요청 상태",
        [r[:2] for r in await request_rows(factory, seeded.session_id)],
        [(1, "completed"), (2, "failed"), (3, "processing")],
    )
    expect(failures, "복원 의도", ctx.intents, [CASUAL, LIGHTER])
    return report("(h) completed 의도는 합쳐지고 failed 의도는 빠짐", failures)


async def check_save_race(factory, pairs: int, member_ids: list[int], rival: str) -> bool:
    settings = get_settings()
    member_id, w = await seed_member(factory, member_ids)
    sessions = [await seed_session(factory, member_id, w) for _ in range(pairs)]
    request_ids = {
        s.session_id: await insert_request(factory, s.session_id, 1, "single", s.outfit2, CASUAL)
        for s in sessions
    }
    before = await read_scores(factory, member_id)
    outcomes: dict[int, dict[str, str]] = {s.session_id: {} for s in sessions}
    barrier = asyncio.Barrier(2 * pairs)

    async def save(seeded: Seeded) -> None:
        await barrier.wait()
        try:
            await regeneration_save.save_regeneration_result(
                request_ids[seeded.session_id],
                seeded.session_id,
                member_id,
                [new_second_outfit(w)],
                supplement_of(w),
            )
            outcomes[seeded.session_id]["save"] = "ok"
        except regeneration_save.RegenerationDiscardedError as e:
            outcomes[seeded.session_id]["save"] = e.reason
        except Exception as e:
            outcomes[seeded.session_id]["save"] = f"{type(e).__name__}: {e}"

    async def end(seeded: Seeded) -> None:
        async with factory() as db:
            await barrier.wait()
            try:
                if rival == "rating":
                    await settlement.rate_and_settle(
                        db, seeded.session_id, member_id, seeded.outfit1, RATING, datetime.now(KST)
                    )
                else:
                    await session_end.cancel_session(
                        db, seeded.session_id, member_id, datetime.now(KST)
                    )
                outcomes[seeded.session_id]["end"] = "ok"
            except Exception as e:
                outcomes[seeded.session_id]["end"] = f"{type(e).__name__}: {e}"

    await asyncio.gather(*(f(s) for s in sessions for f in (save, end)))

    failures: list[str] = []
    saved_first = 0
    expected_status = "completed" if rival == "rating" else "canceled"
    expected_decks = [(1, "initial", 1)] if rival == "rating" else []
    for seeded in sessions:
        outcome = outcomes[seeded.session_id]
        if outcome.get("end") != "ok" or outcome.get("save") not in ("ok", "session_ended"):
            failures.append(f"세션 {seeded.session_id}: 예상 밖 결과 {outcome}")
            continue
        saved_first += outcome["save"] == "ok"
        sid = seeded.session_id
        expect(failures, f"세션 {sid} 상태", await session_status(factory, sid), expected_status)
        expect(failures, f"세션 {sid} 요청", await request_rows(factory, sid), [])
        expect(
            failures, f"세션 {sid} 덱", [r[1:] for r in await decks(factory, sid)], expected_decks
        )

    after = await read_scores(factory, member_id)
    if rival == "rating":
        deltas = settlement_deltas(w, settings)
        failures += compare_scores(after, apply_sequentially(before, deltas, pairs, settings))
    else:
        failures += compare_scores(
            after, {r.preference_score_id: (r.score_sum, r.exposure_count) for r in before}
        )
    name = "별점" if rival == "rating" else "취소"
    print(f"       저장 승 {saved_first}회 / {name} 승 {pairs - saved_first}회")
    label = "(i)" if rival == "rating" else "(j)"
    return report(f"{label} 저장·{name} 동시 요청 {pairs}쌍", failures)


async def main() -> int:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawTextHelpFormatter
    )
    parser.add_argument("--pairs", type=int, default=10, help="동시 요청 쌍 수 (기본 10)")
    parser.add_argument("--keep", action="store_true", help="검증용 회원을 지우지 않고 남긴다")
    args = parser.parse_args()

    engine = create_async_engine(
        get_settings().DATABASE_URL, pool_size=2 * args.pairs + 5, max_overflow=0
    )
    factory = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)
    originals = (regeneration_save.AsyncSessionLocal, regeneration_generation.AsyncSessionLocal)
    regeneration_save.AsyncSessionLocal = factory
    regeneration_generation.AsyncSessionLocal = factory
    member_ids: list[int] = []
    try:
        await warm_up_pool(engine, 2 * args.pairs)
        results = [
            *await check_save_and_settle(factory, member_ids),
            await check_all_target(factory, member_ids),
            await check_empty_generation(factory, member_ids),
            await check_timed_out(factory, member_ids),
            await check_rating_during_generation(factory, member_ids),
            await check_cancel_and_abandon(factory, member_ids),
            await check_intent_merge(factory, member_ids),
            await check_save_race(factory, args.pairs, member_ids, "rating"),
            await check_save_race(factory, args.pairs, member_ids, "cancel"),
        ]
    finally:
        regeneration_save.AsyncSessionLocal, regeneration_generation.AsyncSessionLocal = originals
        if args.keep:
            print(f"검증용 회원을 남겼습니다: member_id={member_ids}")
        else:
            await cleanup(factory, member_ids)
        await engine.dispose()
        await app_engine.dispose()
    return 0 if all(results) else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
