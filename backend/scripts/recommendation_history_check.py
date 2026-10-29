"""추천 내역 목록·상세 검증 스크립트. 실제 MySQL에 붙고 LLM은 호출하지 않는다.

검증용 회원 2명과 세션을 SQL로 직접 넣고, 별점·취소는 서비스 함수로 끝낸 뒤
목록·상세 서비스를 호출한다.
  (a) 다른 회원의 세션이 보이지 않음
  (b) active·canceled·abandoned 세션, 별점 없는 완료 세션, 별점 뒤 미완료로 되돌린 세션은
      빠지고 별점으로 끝난 세션만 최신순
  (c) 페이지 경계: 정확히 limit개, limit+1개, 마지막 페이지 next_cursor null
  (d) 정리 전(코디 여러 벌 남음)에도 별점 코디의 아이템만 슬롯 순서대로
  (e) 옷을 지운 뒤에도 스냅샷 이름·이미지 유지(목록·상세). 상세는 지운 옷만 삭제 표시,
      스타일 태그 []·accessory_type_cd null, 기본 아이템은 삭제 표시 없이 style_cd
  (f) 날씨가 없는 세션은 weather null
  (g) 지역 이름이 저장된 글자 그대로
  (h) 별점·직접 입력 TPO·추천 시각(KST)
  (i) 상세: 다른 회원의 세션은 404, 본인은 조회
  (j) 상세: active·canceled·abandoned, 없는 id, 별점 없는 완료 세션,
      별점 뒤 미완료로 되돌린 세션은 404
  (k) 상세: 정리 전에도 별점 코디의 아이템·유형·사유만
  (l) 상세: 날씨가 없으면 null, 있으면 강수량·풍속·대체값 여부가 저장된 값 그대로
별점 없는 완료 세션과 별점 뒤 미완료로 되돌린 세션은 앱이 만들지 않는 상태를 UPDATE로 만든 것이다.
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
from app.schemas.recommendation_history import (  # noqa: E402
    RecommendationHistoryDetail,
    RecommendationHistoryPage,
)
from app.services import rating_settlement as settlement  # noqa: E402
from app.services import recommendation_history as history_service  # noqa: E402
from app.services import session_cleanup, session_end  # noqa: E402
from app.services.prompt.outfit_generation import CATEGORY_ORDER  # noqa: E402
from app.services.session_errors import SessionNotFoundError  # noqa: E402
from app.services.storage import get_image_storage  # noqa: E402
from app.services.weather.base_time import KST  # noqa: E402
from scripts.session_cleanup_check import expect, insert_weather, seed_member  # noqa: E402
from scripts.settlement_concurrency import (  # noqa: E402
    SeededSession,
    Wardrobe,
    cleanup,
    count,
    create_session,
    delete_clothing,
    report,
)

SEJONG = "세종특별자치시"
UNLISTED_REGION = ("서울특별시", "검증없는구")
CUSTOM_TPO_TEXT = "검증 파티"
RATED_FEEDBACK_SQL = """
    SELECT COUNT(*) FROM outfit_feedback
    WHERE recommendation_session_id = :s AND feedback_type_cd = 'rated'
"""


@dataclass(frozen=True)
class WeatherDetail:
    precipitation: str
    wind_speed: str
    is_fallback: bool


WEATHER = WeatherDetail(precipitation="2.5", wind_speed="6.1", is_fallback=False)
FALLBACK_WEATHER = WeatherDetail(precipitation="0.4", wind_speed="1.7", is_fallback=True)


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
    completed_unrated: SeededSession
    reopened: SeededSession
    other_rated: SeededSession
    ratings: dict[int, int]


async def seed_session(
    factory,
    member_id: int,
    wardrobe: Wardrobe,
    *,
    weather: WeatherDetail | None = WEATHER,
    region: tuple[str, str] | None = None,
    tpo_text: str | None = None,
) -> SeededSession:
    async with factory() as db, db.begin():
        seeded = await create_session(db, member_id, wardrobe)
        if weather is not None:
            await insert_weather(db, seeded.session_id)
            await db.execute(
                text(
                    """
                    UPDATE weather_snapshot
                    SET precipitation = :p, wind_speed = :w, is_fallback = :f
                    WHERE recommendation_session_id = :s
                    """
                ),
                {
                    "p": weather.precipitation,
                    "w": weather.wind_speed,
                    "f": weather.is_fallback,
                    "s": seeded.session_id,
                },
            )
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
        await db.execute(
            text(
                """
                UPDATE outfit o
                JOIN recommendation_deck d ON d.recommendation_deck_id = o.recommendation_deck_id
                SET o.reason = CONCAT('내역검증 사유 ', o.outfit_id)
                WHERE d.recommendation_session_id = :s
                """
            ),
            {"s": seeded.session_id},
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
        weather=None,
        region=(SEJONG, SEJONG),
        tpo_text=CUSTOM_TPO_TEXT,
    )
    rated_uncleaned = await seed_session(
        factory, member_id, wardrobe, weather=FALLBACK_WEATHER, region=UNLISTED_REGION
    )
    active = await seed_session(factory, member_id, wardrobe)
    canceled = await seed_session(factory, member_id, wardrobe)
    abandoned = await seed_session(factory, member_id, wardrobe)
    completed_unrated = await seed_session(factory, member_id, wardrobe)
    reopened = await seed_session(factory, member_id, wardrobe)
    other_rated = await seed_session(factory, other_member_id, other_wardrobe)

    ratings = {
        rated.session_id: 4,
        rated_sejong.session_id: 5,
        rated_uncleaned.session_id: 2,
        reopened.session_id: 1,
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
    await rate(factory, member_id, reopened, ratings[reopened.session_id])
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
        await db.execute(
            text(
                """
                UPDATE recommendation_session
                SET session_status_cd = 'completed',
                    settled_at = UTC_TIMESTAMP(), ended_at = UTC_TIMESTAMP()
                WHERE recommendation_session_id = :s
                """
            ),
            {"s": completed_unrated.session_id},
        )
        await db.execute(
            text(
                """
                UPDATE recommendation_session
                SET session_status_cd = 'active', settled_at = NULL, ended_at = NULL
                WHERE recommendation_session_id = :s
                """
            ),
            {"s": reopened.session_id},
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
        completed_unrated=completed_unrated,
        reopened=reopened,
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


async def fetch_detail(
    factory, member_id: int, session_id: int
) -> RecommendationHistoryDetail | None:
    async with factory() as db:
        try:
            return await history_service.get_history_detail(
                db, get_image_storage(), member_id, session_id
            )
        except SessionNotFoundError:
            return None


async def expected_detail_items(factory, outfit_id: int) -> list[tuple]:
    storage = get_image_storage()
    async with factory() as db:
        rows = (
            await db.execute(
                text(
                    """
                    SELECT i.outfit_item_id, i.slot_cd, i.item_source_cd, i.clothing_id,
                           i.item_name_snapshot, i.image_url_snapshot,
                           COALESCE(c.accessory_type_cd, e.accessory_type_cd) AS accessory_type_cd,
                           e.style_cd AS essential_style_cd
                    FROM outfit_item i
                    LEFT JOIN clothing c ON c.clothing_id = i.clothing_id
                    LEFT JOIN essential_item e ON e.essential_item_id = i.essential_item_id
                    WHERE i.outfit_id = :o
                    """
                ),
                {"o": outfit_id},
            )
        ).all()
        styles: dict[int, list[str]] = {}
        for r in rows:
            if r.clothing_id is not None:
                styles[r.clothing_id] = list(
                    (
                        await db.execute(
                            text(
                                """
                                SELECT style_cd FROM clothing_style
                                WHERE clothing_id = :c ORDER BY clothing_style_id
                                """
                            ),
                            {"c": r.clothing_id},
                        )
                    ).scalars()
                )
    ordered = sorted(rows, key=lambda r: (CATEGORY_ORDER.index(r.slot_cd), r.outfit_item_id))
    return [
        (
            r.slot_cd,
            r.item_source_cd,
            r.item_name_snapshot,
            storage.url(r.image_url_snapshot) if r.image_url_snapshot else None,
            r.accessory_type_cd,
            [r.essential_style_cd]
            if r.item_source_cd == "essential"
            else styles.get(r.clothing_id, []),
            r.item_source_cd == "owned" and r.clothing_id is None,
        )
        for r in ordered
    ]


def detail_items_of(detail: RecommendationHistoryDetail) -> list[tuple]:
    return [
        (
            i.slot_cd,
            i.item_source_cd,
            i.item_name,
            i.image_url,
            i.accessory_type_cd,
            i.style_cds,
            i.is_clothing_deleted,
        )
        for i in detail.outfit.items
    ]


def snapshots_of(detail: RecommendationHistoryDetail) -> list[tuple[str, str, str | None]]:
    return [(i.slot_cd, i.item_name, i.image_url) for i in detail.outfit.items]


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
    expected_statuses = {
        s.active.session_id: "active",
        s.canceled.session_id: "canceled",
        s.abandoned.session_id: "abandoned",
        s.completed_unrated.session_id: "completed",
        s.reopened.session_id: "active",
    }
    expect(
        failures,
        "검증 세션 상태",
        {session_id: statuses.get(session_id) for session_id in expected_statuses},
        expected_statuses,
    )
    expect(
        failures,
        "별점 뒤 미완료로 되돌린 세션의 별점 행",
        await count(factory, RATED_FEEDBACK_SQL, {"s": s.reopened.session_id}),
        1,
    )
    page = await fetch(factory, s.member_id, None, 50)
    expect(failures, "목록 세션 (id 내림차순)", page_ids(page), rated_ids(s))
    expect(failures, "다음 페이지", page.next_cursor, None)
    return report(
        "(b) active·canceled·abandoned·별점 없는 완료·미완료로 되돌린 세션 제외, "
        "별점 세션만 최신순",
        failures,
    )


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
    before_detail = await fetch_detail(factory, s.member_id, s.rated.session_id)
    async with factory() as db, db.begin():
        await delete_clothing(db, deleted_id)
    after_page = await fetch(factory, s.member_id, None, 50)
    after = find_item(failures, after_page, s.rated.session_id)
    after_detail = await fetch_detail(factory, s.member_id, s.rated.session_id)

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
    if before_detail is None or after_detail is None:
        failures.append("삭제 전이나 후의 상세가 404")
    else:
        expect(
            failures,
            "삭제 전후 상세 이름·이미지",
            snapshots_of(after_detail),
            snapshots_of(before_detail),
        )
        expect(
            failures,
            "삭제 전 상세 삭제 표시",
            [i.is_clothing_deleted for i in before_detail.outfit.items],
            [False] * len(before_detail.outfit.items),
        )
        expect(
            failures,
            "삭제 뒤 상세 아이템",
            detail_items_of(after_detail),
            await expected_detail_items(factory, s.rated.rated_outfit_id),
        )
        before_by_slot = {i.slot_cd: i for i in before_detail.outfit.items}
        after_by_slot = {i.slot_cd: i for i in after_detail.outfit.items}
        expect(
            failures,
            "슬롯별 삭제 표시 (top이 지운 옷, shoes가 기본 아이템)",
            {slot: i.is_clothing_deleted for slot, i in after_by_slot.items()},
            {"top": True, "bottom": False, "shoes": False},
        )
        top_before, top, bottom, shoes = (
            before_by_slot.get("top"),
            after_by_slot.get("top"),
            after_by_slot.get("bottom"),
            after_by_slot.get("shoes"),
        )
        if top_before is None or top is None or bottom is None or shoes is None:
            failures.append("상세에 top·bottom·shoes 중 빠진 슬롯이 있음")
        else:
            if not top_before.style_cds:
                failures.append("지우기 전 top의 스타일 태그가 비어 있어 [] 확인이 의미 없음")
            expect(failures, "지운 옷 스타일 태그", top.style_cds, [])
            expect(failures, "지운 옷 accessory_type_cd", top.accessory_type_cd, None)
            if not bottom.style_cds:
                failures.append("지우지 않은 옷의 스타일 태그가 비어 있음")
            expect(
                failures,
                "기본 아이템 출처·스타일 태그",
                (shoes.item_source_cd, shoes.style_cds),
                ("essential", [s.wardrobe.essential_style_cd]),
            )
    return report(
        "(e) 옷을 지운 뒤에도 스냅샷 이름·이미지 유지(목록·상세), 지운 옷만 삭제 표시", failures
    )


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


async def check_detail_other_member(factory, s: Seeded) -> bool:
    failures: list[str] = []
    session_id = s.other_rated.session_id
    mine = await fetch_detail(factory, s.member_id, session_id)
    theirs = await fetch_detail(factory, s.other_member_id, session_id)
    expect(failures, "회원 A가 회원 B 세션 상세를 부르면 404", mine is None, True)
    expect(
        failures,
        "회원 B 본인 세션 상세",
        theirs.recommendation_session_id if theirs is not None else None,
        session_id,
    )
    return report("(i) 상세: 다른 회원의 세션은 404, 본인은 조회", failures)


async def check_detail_not_found(factory, s: Seeded) -> bool:
    failures: list[str] = []
    control = await fetch_detail(factory, s.member_id, s.rated.session_id)
    expect(failures, "본인 별점 세션 상세 (대조)", control is not None, True)
    expect(
        failures,
        "별점 없이 completed로 바꾼 세션의 별점 행",
        await count(factory, RATED_FEEDBACK_SQL, {"s": s.completed_unrated.session_id}),
        0,
    )
    expect(
        failures,
        "별점 뒤 미완료로 되돌린 세션의 별점 행",
        await count(factory, RATED_FEEDBACK_SQL, {"s": s.reopened.session_id}),
        1,
    )
    max_id = await count(
        factory,
        "SELECT COALESCE(MAX(recommendation_session_id), 0) FROM recommendation_session",
        {},
    )
    cases = [
        ("active", s.active.session_id),
        ("canceled", s.canceled.session_id),
        ("abandoned", s.abandoned.session_id),
        ("없는 id 0", 0),
        (f"없는 id {max_id + 1000}", max_id + 1000),
        ("별점 없이 completed로 바꾼 세션", s.completed_unrated.session_id),
        ("별점 뒤 미완료로 되돌린 세션", s.reopened.session_id),
    ]
    for label, session_id in cases:
        detail = await fetch_detail(factory, s.member_id, session_id)
        expect(failures, f"{label} 상세 404", detail is None, True)
    return report(
        "(j) 상세: active·canceled·abandoned·없는 id·별점 없는 완료·미완료로 되돌린 세션은 404",
        failures,
    )


async def check_detail_uncleaned(factory, s: Seeded) -> bool:
    failures: list[str] = []
    seeded = s.rated_uncleaned
    async with factory() as db:
        outfits = (
            await db.execute(
                text(
                    """
                    SELECT o.outfit_id, o.outfit_type_cd, o.reason
                    FROM outfit o
                    JOIN recommendation_deck d
                      ON d.recommendation_deck_id = o.recommendation_deck_id
                    WHERE d.recommendation_session_id = :s
                    """
                ),
                {"s": seeded.session_id},
            )
        ).all()
    if len(outfits) < 2:
        failures.append(f"정리가 건너뛰어지지 않음: 남은 코디 {len(outfits)}벌")
    expect(failures, "코디마다 다른 사유", len({o.reason for o in outfits}), len(outfits))
    rated = next((o for o in outfits if o.outfit_id == seeded.rated_outfit_id), None)
    detail = await fetch_detail(factory, s.member_id, seeded.session_id)
    if rated is None:
        failures.append("별점 코디 행이 없음")
    elif detail is None:
        failures.append("상세가 404")
    else:
        expect(
            failures,
            "코디 유형·사유",
            (detail.outfit.outfit_type_cd, detail.outfit.reason),
            (rated.outfit_type_cd, rated.reason),
        )
        expect(
            failures,
            "아이템",
            detail_items_of(detail),
            await expected_detail_items(factory, rated.outfit_id),
        )
    print(f"       정리 전 남은 코디 {len(outfits)}벌")
    return report("(k) 상세: 정리 전에도 별점 코디의 아이템·유형·사유만", failures)


async def check_detail_weather(factory, s: Seeded) -> bool:
    failures: list[str] = []
    without = await fetch_detail(factory, s.member_id, s.rated_sejong.session_id)
    if without is None:
        failures.append("날씨 없는 세션 상세가 404")
    else:
        expect(failures, "날씨 없는 세션 weather", without.weather, None)
    fallback_seen = False
    for seeded in (s.rated, s.rated_uncleaned):
        async with factory() as db:
            row = (
                await db.execute(
                    text(
                        """
                        SELECT temperature, feels_like_temperature, precipitation, wind_speed,
                               weather_condition_cd, is_fallback
                        FROM weather_snapshot WHERE recommendation_session_id = :s
                        """
                    ),
                    {"s": seeded.session_id},
                )
            ).first()
        if row is None:
            failures.append(f"세션 {seeded.session_id}의 weather_snapshot 행이 없음")
            continue
        if 0 in (row.precipitation, row.wind_speed) or row.precipitation == row.wind_speed:
            failures.append(
                f"세션 {seeded.session_id} 강수량·풍속이 0이거나 같음: "
                f"{row.precipitation}, {row.wind_speed}"
            )
        fallback_seen = fallback_seen or bool(row.is_fallback)
        detail = await fetch_detail(factory, s.member_id, seeded.session_id)
        if detail is None:
            failures.append(f"세션 {seeded.session_id} 상세가 404")
            continue
        expect(
            failures,
            f"세션 {seeded.session_id} weather",
            detail.weather.model_dump() if detail.weather else None,
            {
                "temperature": float(row.temperature),
                "feels_like_temperature": float(row.feels_like_temperature),
                "weather_condition_cd": row.weather_condition_cd,
                "is_fallback": bool(row.is_fallback),
                "precipitation": float(row.precipitation),
                "wind_speed": float(row.wind_speed),
            },
        )
    expect(failures, "대체값 세션 포함", fallback_seen, True)
    return report("(l) 상세: 날씨 없음 null, 강수량·풍속·대체값 여부", failures)


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
            ("(i) 상세 다른 회원", check_detail_other_member),
            ("(j) 상세 404", check_detail_not_found),
            ("(k) 상세 정리 전", check_detail_uncleaned),
            ("(l) 상세 날씨", check_detail_weather),
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
