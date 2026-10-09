"""별점 정산 동시성 검증 스크립트. 실제 MySQL에 붙고 LLM은 호출하지 않는다.

검증용 회원·옷·세션·덱·코디를 SQL로 직접 넣고 rate_and_settle을 동시에 호출한다.
  (a) 같은 세션에 N회 동시 → 정산 1회, 나머지 SESSION_ALREADY_SETTLED, 피드백 행 수 = 코디 수
  (b) 같은 회원의 세션 N개 동시 정산 → 최종 S·N이 순차 계산 결과와 일치 (손실 갱신 없음)
끝나면 검증용 회원을 지운다(FK CASCADE). 개발 회원 데이터는 건드리지 않는다.

backend/ 폴더에서 실행한다 (docker DB와 마이그레이션·시드가 준비돼 있어야 한다):
    python scripts/settlement_concurrency.py
    python scripts/settlement_concurrency.py --concurrency 20 --rating 2 --keep
"""

from __future__ import annotations

import argparse
import asyncio
import sys
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import bindparam, text  # noqa: E402
from sqlalchemy.ext.asyncio import (  # noqa: E402
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import get_settings  # noqa: E402
from app.repositories import outfit_feedback as feedback_repo  # noqa: E402
from app.repositories import preference_score as score_repo  # noqa: E402
from app.repositories.preference_score import ScoreRow  # noqa: E402
from app.services import rating_settlement as settlement  # noqa: E402
from app.services.weather.base_time import KST  # noqa: E402

INITIAL_SCORES = {
    ("style", "minimal"): (Decimal("5.00"), Decimal("0.00")),
    ("style", "street"): (Decimal("-4.00"), Decimal("4.00")),
    ("color", "black"): (Decimal("2.00"), Decimal("1.00")),
}


@dataclass(frozen=True)
class Wardrobe:
    top_minimal_black: int
    bottom_casual_navy: int
    top_street_white: int
    bottom_classic_no_color: int
    outer_romantic_pink_deleted: int
    essential_shoes: int
    essential_style_cd: str
    essential_color_cd: str


@dataclass(frozen=True)
class SeededSession:
    session_id: int
    rated_outfit_id: int
    outfit_count: int


@dataclass
class Outcome:
    succeeded: int = 0
    already_settled: int = 0
    errors: list[str] = field(default_factory=list)


async def create_member(db: AsyncSession) -> int:
    hash_source = f"settlement-check-{uuid.uuid4()}"
    result = await db.execute(
        text(
            """
            INSERT INTO member (provider_cd, provider_user_id_enc, provider_user_id_hash, nickname)
            VALUES ('google', _binary 'SETTLEMENT-CHECK', UNHEX(SHA2(:src, 256)), '정산검증')
            """
        ),
        {"src": hash_source},
    )
    member_id = int(result.lastrowid)
    await db.execute(
        text(
            """
            INSERT INTO preference_score (member_id, attribute_type_cd, attribute_value)
            SELECT :m, 'style', style_cd FROM style
            UNION ALL
            SELECT :m, 'color', color_cd FROM color
            """
        ),
        {"m": member_id},
    )
    for (type_cd, value), (s, n) in INITIAL_SCORES.items():
        await db.execute(
            text(
                """
                UPDATE preference_score SET score_sum = :s, exposure_count = :n
                WHERE member_id = :m AND attribute_type_cd = :t AND attribute_value = :v
                """
            ),
            {"s": s, "n": n, "m": member_id, "t": type_cd, "v": value},
        )
    return member_id


async def insert_clothing(
    db: AsyncSession, member_id: int, category_cd: str, color_cd: str | None, styles: list[str]
) -> int:
    result = await db.execute(
        text(
            """
            INSERT INTO clothing (member_id, processing_status_cd, origin_image_url,
                                  category_cd, item_name, color_cd)
            VALUES (:m, 'completed', 'http://example.invalid/c.png', :cat, '정산검증 옷', :color)
            """
        ),
        {"m": member_id, "cat": category_cd, "color": color_cd},
    )
    clothing_id = int(result.lastrowid)
    for style_cd in styles:
        await db.execute(
            text("INSERT INTO clothing_style (clothing_id, style_cd) VALUES (:c, :s)"),
            {"c": clothing_id, "s": style_cd},
        )
    return clothing_id


async def create_wardrobe(db: AsyncSession, member_id: int) -> Wardrobe:
    essential = (
        await db.execute(
            text(
                """
                SELECT essential_item_id, style_cd, color_cd FROM essential_item
                WHERE category_cd = 'shoes' ORDER BY essential_item_id LIMIT 1
                """
            )
        )
    ).first()
    if essential is None:
        raise RuntimeError("에센셜 신발이 없습니다. scripts/seed.sh로 시드를 먼저 넣어 주세요.")
    return Wardrobe(
        top_minimal_black=await insert_clothing(
            db, member_id, "top", "black", ["minimal", "casual"]
        ),
        bottom_casual_navy=await insert_clothing(db, member_id, "bottom", "navy", ["casual"]),
        top_street_white=await insert_clothing(db, member_id, "top", "white", ["street"]),
        bottom_classic_no_color=await insert_clothing(db, member_id, "bottom", None, ["classic"]),
        outer_romantic_pink_deleted=await insert_clothing(
            db, member_id, "outer", "pink", ["romantic"]
        ),
        essential_shoes=int(essential.essential_item_id),
        essential_style_cd=essential.style_cd,
        essential_color_cd=essential.color_cd,
    )


async def delete_clothing(db: AsyncSession, clothing_id: int) -> None:
    await db.execute(text("DELETE FROM clothing WHERE clothing_id = :c"), {"c": clothing_id})


def expected_deltas(wardrobe: Wardrobe, rating: int, settings) -> dict:
    rejected = settings.SCORE_DELTA_AUTO_REJECTED
    rated = settlement.rating_delta(rating, settings)
    deltas = {
        ("style", "street"): rejected,
        ("color", "white"): rejected,
        ("style", "classic"): rejected,
    }
    for key in [
        ("style", "minimal"),
        ("style", "casual"),
        ("color", "black"),
        ("color", "navy"),
        ("style", wardrobe.essential_style_cd),
        ("color", wardrobe.essential_color_cd),
    ]:
        deltas[key] = rated
    return deltas


async def insert_outfit(
    db: AsyncSession, deck_id: int, seq: int, type_cd: str, items: list[tuple[str, str, int | None]]
) -> int:
    result = await db.execute(
        text(
            """
            INSERT INTO outfit (recommendation_deck_id, outfit_seq, outfit_type_cd, reason)
            VALUES (:d, :seq, :type_cd, '정산검증')
            """
        ),
        {"d": deck_id, "seq": seq, "type_cd": type_cd},
    )
    outfit_id = int(result.lastrowid)
    for slot_cd, source_cd, item_id in items:
        await db.execute(
            text(
                """
                INSERT INTO outfit_item (outfit_id, slot_cd, item_source_cd, clothing_id,
                                         essential_item_id, item_name_snapshot)
                VALUES (:o, :slot, :source, :clothing_id, :essential_id, '정산검증 아이템')
                """
            ),
            {
                "o": outfit_id,
                "slot": slot_cd,
                "source": source_cd,
                "clothing_id": item_id if source_cd == "owned" else None,
                "essential_id": item_id if source_cd == "essential" else None,
            },
        )
    return outfit_id


async def insert_deck(db: AsyncSession, session_id: int, seq: int, trigger: str) -> int:
    result = await db.execute(
        text(
            """
            INSERT INTO recommendation_deck (recommendation_session_id, deck_seq, deck_trigger_cd)
            VALUES (:s, :seq, :trigger)
            """
        ),
        {"s": session_id, "seq": seq, "trigger": trigger},
    )
    return int(result.lastrowid)


async def create_session(db: AsyncSession, member_id: int, wardrobe: Wardrobe) -> SeededSession:
    now = datetime.now(timezone.utc).replace(tzinfo=None, microsecond=0)
    start = now + timedelta(hours=1)
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

    first_deck = await insert_deck(db, session_id, 1, "initial")
    rated = await insert_outfit(
        db,
        first_deck,
        1,
        "preferred",
        [
            ("top", "owned", wardrobe.top_minimal_black),
            ("bottom", "owned", wardrobe.bottom_casual_navy),
            ("shoes", "essential", wardrobe.essential_shoes),
        ],
    )
    await insert_outfit(
        db,
        first_deck,
        2,
        "exploratory",
        [
            ("top", "owned", wardrobe.top_street_white),
            ("bottom", "owned", wardrobe.bottom_classic_no_color),
        ],
    )
    second_deck = await insert_deck(db, session_id, 2, "regeneration")
    await insert_outfit(
        db,
        second_deck,
        1,
        "preferred",
        [
            ("outer", "owned", wardrobe.outer_romantic_pink_deleted),
            ("top", "owned", wardrobe.top_street_white),
            ("bottom", "owned", wardrobe.bottom_casual_navy),
            ("shoes", "essential", wardrobe.essential_shoes),
        ],
    )
    return SeededSession(session_id, rated, outfit_count=3)


async def read_scores(factory: async_sessionmaker, member_id: int) -> list[ScoreRow]:
    async with factory() as db, db.begin():
        return await score_repo.lock_member_scores(db, member_id)


async def warm_up_pool(engine: AsyncEngine, size: int) -> None:
    async def touch():
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
            await asyncio.sleep(0.05)

    await asyncio.gather(*(touch() for _ in range(size)))


async def settle_concurrently(
    factory: async_sessionmaker, member_id: int, targets: list[tuple[int, int]], rating: int
) -> Outcome:
    barrier = asyncio.Barrier(len(targets))
    outcome = Outcome(errors=[])

    async def one(session_id: int, outfit_id: int) -> None:
        async with factory() as db:
            await barrier.wait()
            try:
                await settlement.rate_and_settle(
                    db, session_id, member_id, outfit_id, rating, datetime.now(KST)
                )
                outcome.succeeded += 1
            except settlement.SessionAlreadySettledError:
                outcome.already_settled += 1
            except Exception as e:
                outcome.errors.append(f"{type(e).__name__}: {e}")

    await asyncio.gather(*(one(s, o) for s, o in targets))
    return outcome


def apply_sequentially(
    rows: list[ScoreRow], deltas: dict, times: int, settings
) -> dict[int, tuple[Decimal, Decimal]]:
    current = list(rows)
    for _ in range(times):
        updates = {
            u.preference_score_id: u
            for u in settlement.plan_score_updates(current, deltas, settings)
        }
        current = [
            r._replace(
                score_sum=updates[r.preference_score_id].score_sum,
                exposure_count=updates[r.preference_score_id].exposure_count,
            )
            if r.preference_score_id in updates
            else r
            for r in current
        ]
    return {r.preference_score_id: (r.score_sum, r.exposure_count) for r in current}


def compare_scores(
    actual: list[ScoreRow], expected: dict[int, tuple[Decimal, Decimal]]
) -> list[str]:
    diffs = []
    for r in actual:
        want = expected[r.preference_score_id]
        if (r.score_sum, r.exposure_count) != want:
            diffs.append(
                f"{r.attribute_type_cd}:{r.attribute_value} "
                f"DB=({r.score_sum}, {r.exposure_count}) 기대=({want[0]}, {want[1]})"
            )
    return diffs


async def session_deltas(factory: async_sessionmaker, session_id: int) -> dict:
    async with factory() as db:
        rows = await feedback_repo.find_session_attribute_feedbacks(db, session_id)
    return settlement.resolve_attribute_deltas(rows)


async def count(factory: async_sessionmaker, sql: str, params: dict) -> int:
    async with factory() as db:
        return int((await db.execute(text(sql), params)).scalar_one())


def report(name: str, failures: list[str]) -> bool:
    if failures:
        print(f"[FAIL] {name}")
        for f in failures:
            print(f"       - {f}")
        return False
    print(f"[PASS] {name}")
    return True


async def check_same_session(factory, n: int, rating: int, member_ids: list[int]) -> bool:
    settings = get_settings()
    async with factory() as db, db.begin():
        member_id = await create_member(db)
        member_ids.append(member_id)
        wardrobe = await create_wardrobe(db, member_id)
        seeded = await create_session(db, member_id, wardrobe)
        await delete_clothing(db, wardrobe.outer_romantic_pink_deleted)
    before = await read_scores(factory, member_id)

    outcome = await settle_concurrently(
        factory, member_id, [(seeded.session_id, seeded.rated_outfit_id)] * n, rating
    )

    failures = list(outcome.errors)
    if outcome.succeeded != 1:
        failures.append(f"정산 성공 {outcome.succeeded}회 (기대 1회)")
    if outcome.already_settled != n - 1:
        failures.append(f"409(이미 정산) {outcome.already_settled}회 (기대 {n - 1}회)")
    feedbacks = await count(
        factory,
        "SELECT COUNT(*) FROM outfit_feedback WHERE recommendation_session_id = :s",
        {"s": seeded.session_id},
    )
    if feedbacks != seeded.outfit_count:
        failures.append(f"피드백 {feedbacks}행 (기대 {seeded.outfit_count}행)")
    settled = await count(
        factory,
        """
        SELECT COUNT(*) FROM recommendation_session
        WHERE recommendation_session_id = :s
          AND settled_at IS NOT NULL AND session_status_cd = 'completed'
        """,
        {"s": seeded.session_id},
    )
    if settled != 1:
        failures.append("세션이 completed + settled_at으로 바뀌지 않음")
    deltas = await session_deltas(factory, seeded.session_id)
    want_deltas = expected_deltas(wardrobe, rating, settings)
    if deltas != want_deltas:
        failures.append(f"속성 델타 {sorted(deltas.items())} (기대 {sorted(want_deltas.items())})")
    expected = apply_sequentially(before, deltas, 1, settings)
    failures += compare_scores(await read_scores(factory, member_id), expected)

    return report(f"(a) 같은 세션 {n}회 동시 요청", failures)


async def check_same_member(factory, n: int, rating: int, member_ids: list[int]) -> bool:
    settings = get_settings()
    async with factory() as db, db.begin():
        member_id = await create_member(db)
        member_ids.append(member_id)
        wardrobe = await create_wardrobe(db, member_id)
        # EMA는 적용 순서에 따라 결과가 달라지므로,
        # 커밋 순서와 상관없이 기대값이 하나로 정해지도록 세션을 똑같이 구성한다
        sessions = [await create_session(db, member_id, wardrobe) for _ in range(n)]
        await delete_clothing(db, wardrobe.outer_romantic_pink_deleted)
    before = await read_scores(factory, member_id)

    outcome = await settle_concurrently(
        factory, member_id, [(s.session_id, s.rated_outfit_id) for s in sessions], rating
    )

    failures = list(outcome.errors)
    if outcome.succeeded != n:
        failures.append(f"정산 성공 {outcome.succeeded}회 (기대 {n}회)")
    settled = await count(
        factory,
        """
        SELECT COUNT(*) FROM recommendation_session
        WHERE member_id = :m AND settled_at IS NOT NULL
        """,
        {"m": member_id},
    )
    if settled != n:
        failures.append(f"정산된 세션 {settled}개 (기대 {n}개)")
    feedbacks = await count(
        factory,
        """
        SELECT COUNT(*) FROM outfit_feedback f
        JOIN recommendation_session s ON s.recommendation_session_id = f.recommendation_session_id
        WHERE s.member_id = :m
        """,
        {"m": member_id},
    )
    if feedbacks != n * sessions[0].outfit_count:
        failures.append(f"피드백 {feedbacks}행 (기대 {n * sessions[0].outfit_count}행)")

    all_deltas = [await session_deltas(factory, s.session_id) for s in sessions]
    if any(d != all_deltas[0] for d in all_deltas):
        failures.append("세션마다 속성 델타가 다름 (순차 계산 기대값을 하나로 정할 수 없음)")
    expected = apply_sequentially(before, all_deltas[0], n, settings)
    failures += compare_scores(await read_scores(factory, member_id), expected)

    return report(f"(b) 같은 회원 세션 {n}개 동시 정산", failures)


async def cleanup(factory, member_ids: list[int]) -> None:
    if not member_ids:
        return
    async with factory() as db, db.begin():
        await db.execute(
            text("DELETE FROM member WHERE member_id IN :ids").bindparams(
                bindparam("ids", expanding=True)
            ),
            {"ids": member_ids},
        )


async def main() -> int:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawTextHelpFormatter
    )
    parser.add_argument("--concurrency", type=int, default=20, help="동시 요청 수 (기본 20)")
    parser.add_argument("--rating", type=int, default=4, choices=range(1, 6), help="매길 별점")
    parser.add_argument("--keep", action="store_true", help="검증용 회원을 지우지 않고 남긴다")
    args = parser.parse_args()

    engine = create_async_engine(
        get_settings().DATABASE_URL, pool_size=args.concurrency + 5, max_overflow=0
    )
    factory = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)
    member_ids: list[int] = []
    try:
        await warm_up_pool(engine, args.concurrency)
        ok_a = await check_same_session(factory, args.concurrency, args.rating, member_ids)
        ok_b = await check_same_member(factory, args.concurrency, args.rating, member_ids)
    finally:
        if args.keep:
            print(f"검증용 회원을 남겼습니다: member_id={member_ids}")
        else:
            await cleanup(factory, member_ids)
        await engine.dispose()
    return 0 if ok_a and ok_b else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
