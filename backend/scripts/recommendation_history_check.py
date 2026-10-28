"""추천 내역 목록 검증 스크립트. 실제 MySQL에 붙고 LLM은 호출하지 않는다.

검증용 회원 2명과 세션을 SQL로 직접 넣고, 별점·취소는 서비스 함수로 끝낸 뒤 목록 서비스를 호출한다.
  (a) 다른 회원의 세션이 보이지 않음
  (b) active·canceled·abandoned 세션은 빠지고 별점으로 끝난 세션만 최신순
  (c) 페이지 경계: 정확히 limit개, limit+1개, 마지막 페이지 next_cursor null
  (d) 정리 전(코디 여러 벌 남음)에도 별점 코디의 아이템만 슬롯 순서대로
  (e) 옷을 지운 뒤에도 스냅샷 이름·이미지 유지
  (f) 날씨가 없는 세션은 weather null
  (g) 지역 이름이 저장된 글자 그대로
  (h) 별점·직접 입력 TPO·추천 시각(KST)
끝나면 검증용 회원을 지운다(FK CASCADE). 개발 회원 데이터는 건드리지 않는다.

backend/ 폴더에서 실행한다 (docker DB와 마이그레이션·시드가 준비돼 있어야 한다):
    python scripts/recommendation_history_check.py
    python scripts/recommendation_history_check.py --keep
"""

from __future__ import annotations

import argparse
import asyncio
import sys
from dataclasses import dataclass
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
from app.schemas.recommendation_history import RecommendationHistoryPage  # noqa: E402
from app.services import rating_settlement as settlement  # noqa: E402
from app.services import recommendation_history as history_service  # noqa: E402
from app.services import session_cleanup, session_end  # noqa: E402
from app.services.prompt.outfit_generation import CATEGORY_ORDER  # noqa: E402
from app.services.storage import get_image_storage  # noqa: E402
from app.services.weather.base_time import KST  # noqa: E402
from scripts.session_cleanup_check import expect, insert_weather  # noqa: E402
from scripts.settlement_concurrency import (  # noqa: E402
    SeededSession,
    Wardrobe,
    cleanup,
    count,
    create_member,
    create_session,
    create_wardrobe,
    delete_clothing,
    report,
)

SEJONG = "세종특별자치시"
UNLISTED_REGION = ("서울특별시", "검증없는구")
CUSTOM_TPO_TEXT = "검증 파티"


@dataclass(frozen=True)
class Seeded:
    member_id: int
    other_member_id: int
    wardrobe: Wardrobe
    rated: SeededSession
    rated_sejong: SeededSession
    rated_uncleaned: SeededSession
    active: SeededSession
    canceled: SeededSession
    abandoned: SeededSession
    other_rated: SeededSession
    ratings: dict[int, int]


async def seed_member(factory, member_ids: list[int]) -> tuple[int, Wardrobe]:
    async with factory() as db, db.begin():
        member_id = await create_member(db)
        member_ids.append(member_id)
        wardrobe = await create_wardrobe(db, member_id)
    return member_id, wardrobe


async def seed_session(
    factory,
    member_id: int,
    wardrobe: Wardrobe,
    *,
    weather: bool = True,
    region: tuple[str, str] | None = None,
    tpo_text: str | None = None,
) -> SeededSession:
    async with factory() as db, db.begin():
        seeded = await create_session(db, member_id, wardrobe)
        if weather:
            await insert_weather(db, seeded.session_id)
        if region is not None:
            await db.execute(
                text(
                    """
                    UPDATE recommendation_session SET sido_nm = :sido, sigungu_nm = :sigungu
                    WHERE recommendation_session_id = :s
                    """
                ),
                {"sido": region[0], "sigungu": region[1], "s": seeded.session_id},
            )
        if tpo_text is not None:
            await db.execute(
                text(
                    """
                    UPDATE recommendation_session
                    SET tpo_cd = 'custom', tpo_input_type_cd = 'custom', tpo_text = :t
                    WHERE recommendation_session_id = :s
                    """
                ),
                {"t": tpo_text, "s": seeded.session_id},
            )
        await db.execute(
            text(
                """
                UPDATE outfit_item i
                JOIN outfit o ON o.outfit_id = i.outfit_id
                JOIN recommendation_deck d ON d.recommendation_deck_id = o.recommendation_deck_id
                SET i.item_name_snapshot = CONCAT('내역검증 ', i.outfit_item_id),
                    i.image_url_snapshot = CASE WHEN i.item_source_cd = 'owned'
                        THEN CONCAT('clothing/', :m, '/', i.outfit_item_id, '_cutout.webp') END
                WHERE d.recommendation_session_id = :s
                """
            ),
            {"m": member_id, "s": seeded.session_id},
        )
    return seeded


async def rate(
    factory, member_id: int, seeded: SeededSession, rating: int, *, skip_cleanup: bool = False
) -> None:
    async def skip(db, session_id):
        return session_cleanup.NOTHING_DELETED

    original = settlement.cleanup_ended_session
    if skip_cleanup:
        settlement.cleanup_ended_session = skip
    try:
        async with factory() as db:
            await settlement.rate_and_settle(
                db, seeded.session_id, member_id, seeded.rated_outfit_id, rating, datetime.now(KST)
            )
    finally:
        settlement.cleanup_ended_session = original


async def seed(factory, member_ids: list[int]) -> Seeded:
    member_id, wardrobe = await seed_member(factory, member_ids)
    other_member_id, other_wardrobe = await seed_member(factory, member_ids)

    rated = await seed_session(factory, member_id, wardrobe)
    rated_sejong = await seed_session(
        factory,
        member_id,
        wardrobe,
        weather=False,
        region=(SEJONG, SEJONG),
        tpo_text=CUSTOM_TPO_TEXT,
    )
    rated_uncleaned = await seed_session(factory, member_id, wardrobe, region=UNLISTED_REGION)
    active = await seed_session(factory, member_id, wardrobe)
    canceled = await seed_session(factory, member_id, wardrobe)
    abandoned = await seed_session(factory, member_id, wardrobe)
    other_rated = await seed_session(factory, other_member_id, other_wardrobe)

    ratings = {
        rated.session_id: 4,
        rated_sejong.session_id: 5,
        rated_uncleaned.session_id: 2,
        other_rated.session_id: 3,
    }
    await rate(factory, member_id, rated, ratings[rated.session_id])
    await rate(factory, member_id, rated_sejong, ratings[rated_sejong.session_id])
    await rate(
        factory,
        member_id,
        rated_uncleaned,
        ratings[rated_uncleaned.session_id],
        skip_cleanup=True,
    )
    await rate(factory, other_member_id, other_rated, ratings[other_rated.session_id])
    async with factory() as db:
        await session_end.cancel_session(db, canceled.session_id, member_id, datetime.now(KST))
    async with factory() as db, db.begin():
        await db.execute(
            text(
                """
                UPDATE recommendation_session
                SET session_status_cd = 'abandoned', ended_at = UTC_TIMESTAMP()
                WHERE recommendation_session_id = :s
                """
            ),
            {"s": abandoned.session_id},
        )

    return Seeded(
        member_id=member_id,
        other_member_id=other_member_id,
        wardrobe=wardrobe,
        rated=rated,
        rated_sejong=rated_sejong,
        rated_uncleaned=rated_uncleaned,
        active=active,
        canceled=canceled,
        abandoned=abandoned,
        other_rated=other_rated,
        ratings=ratings,
    )


async def fetch(
    factory, member_id: int, cursor: int | None, limit: int
) -> RecommendationHistoryPage:
    async with factory() as db:
        return await history_service.get_history_page(
            db, get_image_storage(), member_id, cursor, limit
        )


def find_item(failures: list[str], page: RecommendationHistoryPage, session_id: int):
    for item in page.items:
        if item.recommendation_session_id == session_id:
            return item
    failures.append(f"세션 {session_id}이 목록에 없음")
    return None


def page_ids(page: RecommendationHistoryPage) -> list[int]:
    return [item.recommendation_session_id for item in page.items]


def rated_ids(s: Seeded) -> list[int]:
    return sorted(
        [s.rated.session_id, s.rated_sejong.session_id, s.rated_uncleaned.session_id],
        reverse=True,
    )


async def expected_thumbnails(factory, outfit_id: int) -> list[tuple[str, str, str | None]]:
    storage = get_image_storage()
    async with factory() as db:
        rows = (
            await db.execute(
                text(
                    """
                    SELECT outfit_item_id, slot_cd, item_name_snapshot, image_url_snapshot
                    FROM outfit_item WHERE outfit_id = :o
                    """
                ),
                {"o": outfit_id},
            )
        ).all()
    ordered = sorted(rows, key=lambda r: (CATEGORY_ORDER.index(r.slot_cd), r.outfit_item_id))
    return [
        (
            r.slot_cd,
            r.item_name_snapshot,
            storage.url(r.image_url_snapshot) if r.image_url_snapshot else None,
        )
        for r in ordered
    ]


def thumbnails_of(item) -> list[tuple[str, str, str | None]]:
    return [(t.slot_cd, t.item_name, t.image_url) for t in item.thumbnails]


async def check_other_member(factory, s: Seeded) -> bool:
    failures: list[str] = []
    mine = await fetch(factory, s.member_id, None, 50)
    theirs = await fetch(factory, s.other_member_id, None, 50)
    expect(failures, "회원 A 목록에 회원 B 세션", s.other_rated.session_id in page_ids(mine), False)
    expect(failures, "회원 B 목록", page_ids(theirs), [s.other_rated.session_id])
    return report("(a) 다른 회원의 세션이 보이지 않음", failures)


async def check_status_filter(factory, s: Seeded) -> bool:
    failures: list[str] = []
    async with factory() as db:
        statuses = dict(
            (
                await db.execute(
                    text(
                        """
                        SELECT recommendation_session_id, session_status_cd
                        FROM recommendation_session WHERE member_id = :m
                        """
                    ),
                    {"m": s.member_id},
                )
            ).all()
        )
    expect(
        failures,
        "검증 세션 상태",
        {
            statuses.get(s.active.session_id),
            statuses.get(s.canceled.session_id),
            statuses.get(s.abandoned.session_id),
        },
        {"active", "canceled", "abandoned"},
    )
    page = await fetch(factory, s.member_id, None, 50)
    expect(failures, "목록 세션 (id 내림차순)", page_ids(page), rated_ids(s))
    expect(failures, "다음 페이지", page.next_cursor, None)
    return report("(b) active·canceled·abandoned 제외, 별점 세션만 최신순", failures)


async def check_page_boundaries(factory, s: Seeded) -> bool:
    failures: list[str] = []
    expected = rated_ids(s)
    n = len(expected)

    exact = await fetch(factory, s.member_id, None, n)
    expect(failures, f"limit={n} 세션", page_ids(exact), expected)
    expect(failures, f"limit={n} next_cursor", exact.next_cursor, None)

    first = await fetch(factory, s.member_id, None, n - 1)
    expect(failures, f"limit={n - 1} 첫 페이지 세션", page_ids(first), expected[: n - 1])
    expect(failures, f"limit={n - 1} 첫 페이지 next_cursor", first.next_cursor, expected[n - 2])
    if first.next_cursor is None:
        failures.append("첫 페이지 next_cursor가 없어 다음 페이지를 확인하지 못함")
    else:
        second = await fetch(factory, s.member_id, first.next_cursor, n - 1)
        expect(failures, "두 번째 페이지 세션", page_ids(second), expected[n - 1 :])
        expect(failures, "두 번째 페이지 next_cursor", second.next_cursor, None)

    after_last = await fetch(factory, s.member_id, expected[-1], n)
    expect(
        failures,
        "마지막 세션 다음 페이지",
        (page_ids(after_last), after_last.next_cursor),
        ([], None),
    )
    return report(f"(c) 페이지 경계 (별점 세션 {n}개)", failures)


async def check_uncleaned_session(factory, s: Seeded) -> bool:
    failures: list[str] = []
    outfit_count = await count(
        factory,
        """
        SELECT COUNT(*) FROM outfit o
        JOIN recommendation_deck d ON d.recommendation_deck_id = o.recommendation_deck_id
        WHERE d.recommendation_session_id = :s
        """,
        {"s": s.rated_uncleaned.session_id},
    )
    if outfit_count < 2:
        failures.append(f"정리가 건너뛰어지지 않음: 남은 코디 {outfit_count}벌")
    page = await fetch(factory, s.member_id, None, 50)
    item = find_item(failures, page, s.rated_uncleaned.session_id)
    if item is not None:
        expect(
            failures,
            "썸네일",
            thumbnails_of(item),
            await expected_thumbnails(factory, s.rated_uncleaned.rated_outfit_id),
        )
    print(f"       정리 전 남은 코디 {outfit_count}벌")
    return report("(d) 정리 전에도 별점 코디의 아이템만 슬롯 순서대로", failures)


async def check_deleted_clothing(factory, s: Seeded) -> bool:
    failures: list[str] = []
    deleted_id = s.wardrobe.top_minimal_black
    used = await count(
        factory,
        "SELECT COUNT(*) FROM outfit_item WHERE outfit_id = :o AND clothing_id = :c",
        {"o": s.rated.rated_outfit_id, "c": deleted_id},
    )
    expect(failures, "삭제할 옷이 별점 코디에 쓰임", used, 1)

    before_page = await fetch(factory, s.member_id, None, 50)
    before = find_item(failures, before_page, s.rated.session_id)
    async with factory() as db, db.begin():
        await delete_clothing(db, deleted_id)
    after_page = await fetch(factory, s.member_id, None, 50)
    after = find_item(failures, after_page, s.rated.session_id)

    orphaned = await count(
        factory,
        """
        SELECT COUNT(*) FROM outfit_item
        WHERE outfit_id = :o AND item_source_cd = 'owned' AND clothing_id IS NULL
        """,
        {"o": s.rated.rated_outfit_id},
    )
    expect(failures, "clothing_id가 NULL이 된 아이템", orphaned, 1)
    if before is not None and after is not None:
        expect(failures, "삭제 전후 썸네일", thumbnails_of(after), thumbnails_of(before))
        expect(
            failures,
            "썸네일이 스냅샷과 같음",
            thumbnails_of(after),
            await expected_thumbnails(factory, s.rated.rated_outfit_id),
        )
        if not any(t.image_url for t in after.thumbnails):
            failures.append("이미지가 있는 썸네일이 없음")
    return report("(e) 옷을 지운 뒤에도 스냅샷 이름·이미지 유지", failures)


async def check_weather(factory, s: Seeded) -> bool:
    failures: list[str] = []
    page = await fetch(factory, s.member_id, None, 50)
    without = find_item(failures, page, s.rated_sejong.session_id)
    with_weather = find_item(failures, page, s.rated.session_id)
    if without is not None:
        expect(failures, "날씨 없는 세션 weather", without.weather, None)
        expect(failures, "날씨 없는 세션 썸네일 수", len(without.thumbnails) > 0, True)
    if with_weather is not None:
        async with factory() as db:
            row = (
                await db.execute(
                    text(
                        """
                        SELECT temperature, feels_like_temperature, weather_condition_cd,
                               is_fallback
                        FROM weather_snapshot WHERE recommendation_session_id = :s
                        """
                    ),
                    {"s": s.rated.session_id},
                )
            ).first()
        if row is None:
            failures.append("날씨 있는 세션의 weather_snapshot 행이 없음")
        else:
            expect(
                failures,
                "날씨 있는 세션 weather",
                with_weather.weather.model_dump() if with_weather.weather else None,
                {
                    "temperature": float(row.temperature),
                    "feels_like_temperature": float(row.feels_like_temperature),
                    "weather_condition_cd": row.weather_condition_cd,
                    "is_fallback": bool(row.is_fallback),
                },
            )
    return report("(f) 날씨가 없는 세션은 weather null", failures)


async def check_region(factory, s: Seeded) -> bool:
    failures: list[str] = []
    page = await fetch(factory, s.member_id, None, 50)
    for seeded, region in (
        (s.rated_sejong, (SEJONG, SEJONG)),
        (s.rated_uncleaned, UNLISTED_REGION),
    ):
        item = find_item(failures, page, seeded.session_id)
        if item is not None:
            expect(
                failures,
                f"세션 {seeded.session_id} 지역",
                (item.condition.sido_nm, item.condition.sigungu_nm),
                region,
            )
    return report("(g) 지역 이름이 저장된 글자 그대로", failures)


async def check_values(factory, s: Seeded) -> bool:
    failures: list[str] = []
    page = await fetch(factory, s.member_id, None, 50)
    async with factory() as db:
        created = dict(
            (
                await db.execute(
                    text(
                        """
                        SELECT recommendation_session_id, created_at
                        FROM recommendation_session WHERE member_id = :m
                        """
                    ),
                    {"m": s.member_id},
                )
            ).all()
        )
    for session_id in rated_ids(s):
        item = find_item(failures, page, session_id)
        if item is None:
            continue
        expect(failures, f"세션 {session_id} 별점", item.rating, s.ratings[session_id])
        expect(
            failures,
            f"세션 {session_id} 추천 시각 오프셋",
            item.recommended_at.utcoffset(),
            timedelta(hours=9),
        )
        db_created = created.get(session_id)
        if db_created is None:
            failures.append(f"세션 {session_id} created_at을 읽지 못함")
        else:
            expect(
                failures,
                f"세션 {session_id} 추천 시각",
                item.recommended_at.replace(tzinfo=None) - timedelta(hours=9),
                db_created,
            )
    custom = find_item(failures, page, s.rated_sejong.session_id)
    if custom is not None:
        expect(
            failures,
            "직접 입력 TPO",
            (custom.condition.tpo_cd, custom.condition.tpo_text),
            ("custom", CUSTOM_TPO_TEXT),
        )
    return report("(h) 별점·직접 입력 TPO·추천 시각(KST)", failures)


async def run_check(name: str, check, factory, s: Seeded) -> bool:
    try:
        return await check(factory, s)
    except Exception as e:
        return report(name, [f"예외 {type(e).__name__}: {e}"])


async def main() -> int:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawTextHelpFormatter
    )
    parser.add_argument("--keep", action="store_true", help="검증용 회원을 지우지 않고 남긴다")
    args = parser.parse_args()

    engine = create_async_engine(get_settings().DATABASE_URL)
    factory = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)
    member_ids: list[int] = []
    try:
        s = await seed(factory, member_ids)
        checks = [
            ("(a) 다른 회원", check_other_member),
            ("(b) 상태", check_status_filter),
            ("(c) 페이지 경계", check_page_boundaries),
            ("(d) 정리 전", check_uncleaned_session),
            ("(e) 옷 삭제", check_deleted_clothing),
            ("(f) 날씨", check_weather),
            ("(g) 지역", check_region),
            ("(h) 값", check_values),
        ]
        results = [await run_check(name, check, factory, s) for name, check in checks]
    finally:
        if args.keep:
            print(f"검증용 회원을 남겼습니다: member_id={member_ids}")
        else:
            await cleanup(factory, member_ids)
            remaining = [
                await count(factory, "SELECT COUNT(*) FROM member WHERE member_id = :m", {"m": m})
                for m in member_ids
            ]
            print(f"검증용 회원 {member_ids} 삭제, 남은 행 {sum(remaining)}")
        await engine.dispose()
    return 0 if all(results) else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
