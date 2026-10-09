"""세션 취소·이탈·정리 검증 스크립트. 실제 MySQL에 붙고 LLM은 호출하지 않는다.

검증용 회원·옷·세션·덱·코디를 SQL로 직접 넣고 서비스 함수를 호출한다.
  (a) 별점 → 정산 직후 정리: 코디 1·덱 1·피드백 1, single 재추천 요청 삭제,
      all 요청은 남고 result_deck_id만 NULL
  (b) 취소: 덱·코디·피드백 0, settled_at NULL, ended_at 기록, 날씨 유지, 선호 점수 27행 S·N 그대로
  (c) 이탈: 무활동 세션만 abandoned + 정리, 최근 덱이 있거나 새 세션은 그대로, 선호 점수 그대로
      (배치 run()은 개발 회원 세션까지 건드리므로 부르지 않고,
       검증용 세션에만 abandon_if_inactive를 호출한다)
  (d) 생성 중 취소: generation failed, 그 뒤 complete_generation은 거부되고 덱이 생기지 않음
  (e) 정리가 빠진 세션을 배치용 조회가 찾아 다시 정리하고, 두 번째 정리는 아무것도 지우지 않음
  (f) 같은 세션에 취소·별점 동시 요청 → 하나만 성공, 최종 상태와 S·N이 순차 계산과 일치
끝나면 검증용 회원을 지운다(FK CASCADE). 개발 회원 데이터는 건드리지 않는다.

backend/ 폴더에서 실행한다 (docker DB와 마이그레이션·시드가 준비돼 있어야 한다):
    python scripts/session_cleanup_check.py
    python scripts/session_cleanup_check.py --races 20 --keep
"""

from __future__ import annotations

import argparse
import asyncio
import sys
from datetime import datetime, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import text  # noqa: E402
from sqlalchemy.ext.asyncio import (  # noqa: E402
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import get_settings  # noqa: E402
from app.repositories import recommendation_session as session_repo  # noqa: E402
from app.services import rating_settlement as settlement  # noqa: E402
from app.services import recommendation_result as result_service  # noqa: E402
from app.services import session_cleanup, session_end  # noqa: E402
from app.services.recommendation_session import to_db_utc  # noqa: E402
from app.services.weather.base_time import KST  # noqa: E402
from scripts.settlement_concurrency import (  # noqa: E402
    SeededSession,
    Wardrobe,
    apply_sequentially,
    cleanup,
    compare_scores,
    count,
    create_member,
    create_session,
    create_wardrobe,
    delete_clothing,
    expected_deltas,
    insert_deck,
    read_scores,
    report,
    warm_up_pool,
)

RATING = 4


async def seed_member(factory, member_ids: list[int]) -> tuple[int, Wardrobe]:
    async with factory() as db, db.begin():
        member_id = await create_member(db)
        member_ids.append(member_id)
        wardrobe = await create_wardrobe(db, member_id)
    return member_id, wardrobe


async def seed_session(factory, member_id: int, wardrobe: Wardrobe) -> SeededSession:
    async with factory() as db, db.begin():
        seeded = await create_session(db, member_id, wardrobe)
        await insert_weather(db, seeded.session_id)
    return seeded


async def insert_weather(db: AsyncSession, session_id: int) -> None:
    await db.execute(
        text(
            """
            INSERT INTO weather_snapshot (recommendation_session_id, temperature,
                                          feels_like_temperature, weather_condition_cd)
            VALUES (:s, 14.2, 12.8, 'cloudy')
            """
        ),
        {"s": session_id},
    )


async def insert_regeneration_requests(factory, session_id: int) -> None:
    async with factory() as db, db.begin():
        outfits = (
            await db.execute(
                text(
                    """
                    SELECT o.outfit_id, d.recommendation_deck_id, d.deck_seq, o.outfit_seq
                    FROM outfit o
                    JOIN recommendation_deck d
                      ON d.recommendation_deck_id = o.recommendation_deck_id
                    WHERE d.recommendation_session_id = :s
                    ORDER BY d.deck_seq, o.outfit_seq
                    """
                ),
                {"s": session_id},
            )
        ).all()
        unrated = next(o for o in outfits if (o.deck_seq, o.outfit_seq) == (1, 2))
        second_deck = next(o.recommendation_deck_id for o in outfits if o.deck_seq == 2)
        await db.execute(
            text(
                """
                INSERT INTO regeneration_request (recommendation_session_id, request_seq,
                    target_scope_cd, target_outfit_id, result_deck_id, request_text)
                VALUES (:s, 1, 'single', :o, :d, '검증 single'),
                       (:s, 2, 'all', NULL, :d, '검증 all')
                """
            ),
            {"s": session_id, "o": unrated.outfit_id, "d": second_deck},
        )


async def session_counts(factory, session_id: int) -> dict[str, int]:
    params = {"s": session_id}
    return {
        "deck": await count(
            factory,
            "SELECT COUNT(*) FROM recommendation_deck WHERE recommendation_session_id = :s",
            params,
        ),
        "outfit": await count(
            factory,
            """
            SELECT COUNT(*) FROM outfit o
            JOIN recommendation_deck d ON d.recommendation_deck_id = o.recommendation_deck_id
            WHERE d.recommendation_session_id = :s
            """,
            params,
        ),
        "outfit_item": await count(
            factory,
            """
            SELECT COUNT(*) FROM outfit_item i
            JOIN outfit o ON o.outfit_id = i.outfit_id
            JOIN recommendation_deck d ON d.recommendation_deck_id = o.recommendation_deck_id
            WHERE d.recommendation_session_id = :s
            """,
            params,
        ),
        "feedback": await count(
            factory,
            "SELECT COUNT(*) FROM outfit_feedback WHERE recommendation_session_id = :s",
            params,
        ),
        "weather": await count(
            factory,
            "SELECT COUNT(*) FROM weather_snapshot WHERE recommendation_session_id = :s",
            params,
        ),
    }


async def session_row(factory, session_id: int):
    async with factory() as db:
        return (
            await db.execute(
                text(
                    """
                    SELECT session_status_cd, generation_status_cd, settled_at, ended_at
                    FROM recommendation_session WHERE recommendation_session_id = :s
                    """
                ),
                {"s": session_id},
            )
        ).one()


async def result_outfit_ids(factory, session_id: int, member_id: int) -> list[int]:
    async with factory() as db:
        result = await result_service.get_recommendation_result(db, session_id, member_id)
    return [o.outfit_id for o in result.outfits]


def expect(failures: list[str], name: str, actual, expected) -> None:
    if actual != expected:
        failures.append(f"{name}: {actual} (기대 {expected})")


def expect_ended_without_settlement(failures: list[str], row, status: str) -> None:
    expect(failures, "session_status_cd", row.session_status_cd, status)
    expect(failures, "settled_at", row.settled_at, None)
    if row.ended_at is None:
        failures.append("ended_at이 기록되지 않음")


def expect_cleared(failures: list[str], counts: dict[str, int]) -> None:
    expect(
        failures,
        "남은 행",
        counts,
        {"deck": 0, "outfit": 0, "outfit_item": 0, "feedback": 0, "weather": 1},
    )


async def expect_scores_unchanged(factory, failures: list[str], member_id: int, before) -> None:
    after = await read_scores(factory, member_id)
    expect(failures, "선호 점수 행 수", len(after), 27)
    failures += compare_scores(
        after, {r.preference_score_id: (r.score_sum, r.exposure_count) for r in before}
    )


async def check_rating_cleanup(factory, member_ids: list[int]) -> bool:
    member_id, wardrobe = await seed_member(factory, member_ids)
    seeded = await seed_session(factory, member_id, wardrobe)
    await insert_regeneration_requests(factory, seeded.session_id)

    async with factory() as db:
        await settlement.rate_and_settle(
            db, seeded.session_id, member_id, seeded.rated_outfit_id, RATING, datetime.now(KST)
        )

    failures: list[str] = []
    expect(
        failures,
        "남은 행",
        await session_counts(factory, seeded.session_id),
        {"deck": 1, "outfit": 1, "outfit_item": 3, "feedback": 1, "weather": 1},
    )
    expect(
        failures,
        "남은 피드백 유형",
        await count(
            factory,
            """
            SELECT COUNT(*) FROM outfit_feedback
            WHERE recommendation_session_id = :s AND outfit_id = :o AND feedback_type_cd = 'rated'
            """,
            {"s": seeded.session_id, "o": seeded.rated_outfit_id},
        ),
        1,
    )
    async with factory() as db:
        requests = (
            await db.execute(
                text(
                    """
                    SELECT target_scope_cd, result_deck_id FROM regeneration_request
                    WHERE recommendation_session_id = :s
                    """
                ),
                {"s": seeded.session_id},
            )
        ).all()
    expect(failures, "재추천 요청", [tuple(r) for r in requests], [("all", None)])
    expect(
        failures,
        "결과 조회 코디",
        await result_outfit_ids(factory, seeded.session_id, member_id),
        [seeded.rated_outfit_id],
    )
    return report("(a) 별점 세션 정리: 코디 1·덱 1", failures)


async def check_cancel(factory, member_ids: list[int]) -> bool:
    member_id, wardrobe = await seed_member(factory, member_ids)
    seeded = await seed_session(factory, member_id, wardrobe)
    before = await read_scores(factory, member_id)

    async with factory() as db:
        status = await session_end.cancel_session(
            db, seeded.session_id, member_id, datetime.now(KST)
        )
    async with factory() as db:
        again = await session_end.cancel_session(
            db, seeded.session_id, member_id, datetime.now(KST)
        )

    failures: list[str] = []
    expect(failures, "취소 응답", (status, again), ("canceled", "canceled"))
    row = await session_row(factory, seeded.session_id)
    expect_ended_without_settlement(failures, row, "canceled")
    expect(failures, "generation_status_cd", row.generation_status_cd, "completed")
    expect_cleared(failures, await session_counts(factory, seeded.session_id))
    expect(
        failures,
        "결과 조회 코디",
        await result_outfit_ids(factory, seeded.session_id, member_id),
        [],
    )
    await expect_scores_unchanged(factory, failures, member_id, before)
    return report("(b) 취소: 덱 0·피드백 0·S·N 그대로", failures)


async def backdate(factory, session_id: int, minutes: int, *, decks: bool) -> None:
    async with factory() as db, db.begin():
        await db.execute(
            text(
                """
                UPDATE recommendation_session
                SET created_at = created_at - INTERVAL :m MINUTE
                WHERE recommendation_session_id = :s
                """
            ),
            {"m": minutes, "s": session_id},
        )
        if decks:
            await db.execute(
                text(
                    """
                    UPDATE recommendation_deck
                    SET created_at = created_at - INTERVAL :m MINUTE
                    WHERE recommendation_session_id = :s
                    """
                ),
                {"m": minutes, "s": session_id},
            )


async def set_generation_processing(factory, session_id: int) -> None:
    async with factory() as db, db.begin():
        await db.execute(
            text("DELETE FROM recommendation_deck WHERE recommendation_session_id = :s"),
            {"s": session_id},
        )
        await db.execute(
            text(
                """
                UPDATE recommendation_session SET generation_status_cd = 'processing'
                WHERE recommendation_session_id = :s
                """
            ),
            {"s": session_id},
        )


async def check_abandon(factory, member_ids: list[int]) -> bool:
    timeout = get_settings().SESSION_ABANDON_TIMEOUT_MINUTES
    old = timeout + 1
    member_id, wardrobe = await seed_member(factory, member_ids)
    idle = await seed_session(factory, member_id, wardrobe)
    await backdate(factory, idle.session_id, old, decks=True)
    stuck = await seed_session(factory, member_id, wardrobe)
    await set_generation_processing(factory, stuck.session_id)
    await backdate(factory, stuck.session_id, old, decks=False)
    recent_deck = await seed_session(factory, member_id, wardrobe)
    await backdate(factory, recent_deck.session_id, old, decks=False)
    fresh = await seed_session(factory, member_id, wardrobe)
    before = await read_scores(factory, member_id)

    now = datetime.now(KST)
    since = to_db_utc(now) - timedelta(minutes=timeout)
    ours = {idle.session_id, stuck.session_id, recent_deck.session_id, fresh.session_id}
    async with factory() as db:
        found = set(await session_repo.find_inactive_session_ids(db, since)) & ours
        activity = {
            sid: await session_repo.has_activity_since(db, sid, since) for sid in sorted(ours)
        }

    failures: list[str] = []
    expect(failures, "이탈 후보", found, {idle.session_id, stuck.session_id})
    expect(
        failures,
        "단건 활동 판정이 후보 조회와 일치",
        {s for s, a in activity.items() if not a},
        found,
    )

    abandoned = set()
    for sid in sorted(ours):
        async with factory() as db:
            if await session_end.abandon_if_inactive(db, sid, since, now):
                abandoned.add(sid)
    expect(failures, "이탈 처리된 세션", abandoned, {idle.session_id, stuck.session_id})

    for seeded, generation in ((idle, "completed"), (stuck, "failed")):
        row = await session_row(factory, seeded.session_id)
        expect_ended_without_settlement(failures, row, "abandoned")
        expect(
            failures, f"세션 {seeded.session_id} generation", row.generation_status_cd, generation
        )
        expect_cleared(failures, await session_counts(factory, seeded.session_id))
    for seeded in (recent_deck, fresh):
        row = await session_row(factory, seeded.session_id)
        expect(failures, f"세션 {seeded.session_id} 상태", row.session_status_cd, "active")
        expect(
            failures,
            f"세션 {seeded.session_id} 덱",
            (await session_counts(factory, seeded.session_id))["deck"],
            2,
        )
    await expect_scores_unchanged(factory, failures, member_id, before)
    return report("(c) 이탈: 무활동 세션만 abandoned·S·N 그대로", failures)


async def check_cancel_during_generation(factory, member_ids: list[int]) -> bool:
    member_id, wardrobe = await seed_member(factory, member_ids)
    seeded = await seed_session(factory, member_id, wardrobe)
    await set_generation_processing(factory, seeded.session_id)

    async with factory() as db:
        await session_end.cancel_session(db, seeded.session_id, member_id, datetime.now(KST))
    async with factory() as db, db.begin():
        completed = await session_repo.complete_generation(db, seeded.session_id, False)
        if completed:
            await insert_deck(db, seeded.session_id, 1, "initial")

    failures: list[str] = []
    row = await session_row(factory, seeded.session_id)
    expect_ended_without_settlement(failures, row, "canceled")
    expect(failures, "generation_status_cd", row.generation_status_cd, "failed")
    expect(failures, "취소 뒤 complete_generation", completed, False)
    expect_cleared(failures, await session_counts(factory, seeded.session_id))
    return report("(d) 생성 중 취소: failed 기록, 이후 저장 거부", failures)


async def check_leftover_cleanup(factory, member_ids: list[int]) -> bool:
    member_id, wardrobe = await seed_member(factory, member_ids)
    rated = await seed_session(factory, member_id, wardrobe)
    canceled = await seed_session(factory, member_id, wardrobe)

    async def skip_cleanup(db, session_id):
        return session_cleanup.NOTHING_DELETED

    original = settlement.cleanup_ended_session
    settlement.cleanup_ended_session = skip_cleanup
    try:
        async with factory() as db:
            await settlement.rate_and_settle(
                db, rated.session_id, member_id, rated.rated_outfit_id, RATING, datetime.now(KST)
            )
    finally:
        settlement.cleanup_ended_session = original
    async with factory() as db, db.begin():
        await db.execute(
            text(
                """
                UPDATE recommendation_session
                SET session_status_cd = 'canceled', ended_at = UTC_TIMESTAMP()
                WHERE recommendation_session_id = :s
                """
            ),
            {"s": canceled.session_id},
        )

    ours = {rated.session_id, canceled.session_id}
    failures: list[str] = []
    async with factory() as db:
        found = set(await session_repo.find_sessions_to_clean(db)) & ours
    expect(failures, "정리 대상 (정리 전)", found, ours)

    first, second = {}, {}
    for sid in sorted(ours):
        async with factory() as db:
            first[sid] = await session_cleanup.cleanup_ended_session(db, sid)
        async with factory() as db:
            second[sid] = await session_cleanup.cleanup_ended_session(db, sid)

    expect(
        failures,
        "첫 정리",
        first,
        {
            rated.session_id: session_cleanup.CleanupResult(2, 1),
            canceled.session_id: session_cleanup.CleanupResult(3, 2),
        },
    )
    expect(
        failures,
        "두 번째 정리",
        set(second.values()),
        {session_cleanup.NOTHING_DELETED},
    )
    async with factory() as db:
        found_after = set(await session_repo.find_sessions_to_clean(db)) & ours
    expect(failures, "정리 대상 (정리 후)", found_after, set())
    expect(
        failures,
        "별점 세션 덱·코디",
        {
            k: v
            for k, v in (await session_counts(factory, rated.session_id)).items()
            if k in ("deck", "outfit")
        },
        {"deck": 1, "outfit": 1},
    )
    expect_cleared(failures, await session_counts(factory, canceled.session_id))
    return report("(e) 남은 정리: 배치 조회로 찾고 다시 실행해도 같음", failures)


async def check_cancel_rating_race(factory, races: int, member_ids: list[int]) -> bool:
    settings = get_settings()
    member_id, wardrobe = await seed_member(factory, member_ids)
    sessions = [await seed_session(factory, member_id, wardrobe) for _ in range(races)]
    async with factory() as db, db.begin():
        await delete_clothing(db, wardrobe.outer_romantic_pink_deleted)
    before = await read_scores(factory, member_id)

    outcomes: dict[int, dict[str, str]] = {s.session_id: {} for s in sessions}
    barrier = asyncio.Barrier(2 * races)

    async def cancel(seeded: SeededSession) -> None:
        async with factory() as db:
            await barrier.wait()
            try:
                await session_end.cancel_session(
                    db, seeded.session_id, member_id, datetime.now(KST)
                )
                outcomes[seeded.session_id]["cancel"] = "ok"
            except Exception as e:
                outcomes[seeded.session_id]["cancel"] = type(e).__name__

    async def rate(seeded: SeededSession) -> None:
        async with factory() as db:
            await barrier.wait()
            try:
                await settlement.rate_and_settle(
                    db,
                    seeded.session_id,
                    member_id,
                    seeded.rated_outfit_id,
                    RATING,
                    datetime.now(KST),
                )
                outcomes[seeded.session_id]["rate"] = "ok"
            except Exception as e:
                outcomes[seeded.session_id]["rate"] = type(e).__name__

    await asyncio.gather(*(f(s) for s in sessions for f in (cancel, rate)))

    failures: list[str] = []
    completed = 0
    allowed = {
        ("ok", "SessionNotRatableError"): "canceled",
        ("SessionAlreadySettledError", "ok"): "completed",
    }
    for seeded in sessions:
        outcome = outcomes[seeded.session_id]
        key = (outcome.get("cancel"), outcome.get("rate"))
        status = allowed.get(key)
        if status is None:
            failures.append(f"세션 {seeded.session_id}: 예상 밖 결과 {key}")
            continue
        row = await session_row(factory, seeded.session_id)
        counts = await session_counts(factory, seeded.session_id)
        expect(failures, f"세션 {seeded.session_id} 상태", row.session_status_cd, status)
        if status == "completed":
            completed += 1
            expect(
                failures,
                f"세션 {seeded.session_id} 덱·코디·피드백",
                (counts["deck"], counts["outfit"], counts["feedback"]),
                (1, 1, 1),
            )
        else:
            expect_ended_without_settlement(failures, row, "canceled")
            expect_cleared(failures, counts)

    expected = apply_sequentially(
        before, expected_deltas(wardrobe, RATING, settings), completed, settings
    )
    failures += compare_scores(await read_scores(factory, member_id), expected)
    print(f"       취소 승 {races - completed}회 / 별점 승 {completed}회")
    return report(f"(f) 취소·별점 동시 요청 {races}쌍", failures)


async def main() -> int:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawTextHelpFormatter
    )
    parser.add_argument("--races", type=int, default=10, help="동시 요청 쌍 수 (기본 10)")
    parser.add_argument("--keep", action="store_true", help="검증용 회원을 지우지 않고 남긴다")
    args = parser.parse_args()

    engine = create_async_engine(
        get_settings().DATABASE_URL, pool_size=2 * args.races + 5, max_overflow=0
    )
    factory = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)
    member_ids: list[int] = []
    try:
        await warm_up_pool(engine, 2 * args.races)
        results = [
            await check_rating_cleanup(factory, member_ids),
            await check_cancel(factory, member_ids),
            await check_abandon(factory, member_ids),
            await check_cancel_during_generation(factory, member_ids),
            await check_leftover_cleanup(factory, member_ids),
            await check_cancel_rating_race(factory, args.races, member_ids),
        ]
    finally:
        if args.keep:
            print(f"검증용 회원을 남겼습니다: member_id={member_ids}")
        else:
            await cleanup(factory, member_ids)
        await engine.dispose()
    return 0 if all(results) else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
