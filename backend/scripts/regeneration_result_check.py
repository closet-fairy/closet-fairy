"""재추천 결과 조회 검증 스크립트 (#88). 실제 MySQL에 붙고 LLM은 호출하지 않는다.

regeneration_save_check.py와 같은 방식으로 검증용 회원·옷·세션·첫 덱(1번 선호, 2번 탐색)을
SQL로 넣고, 코디 생성만 가짜로 바꿔 재추천 파이프라인을 돌린 뒤 결과 조회 서비스를 호출한다.
  (a) 2번 세트를 두 번 재추천 → 2번 현재 코디는 3번째 덱, 이전 코디 2벌이 최신순,
      1번은 이전 코디 없음, 이전 코디의 보유 옷 스타일 태그가 채워짐
  (b) 재추천 실패 → 재추천 상태 failed, 현재 코디는 요청 전 그대로
  (c) 앞 요청 completed + 최근 요청 failed → 최근 요청(failed)이 옴
  (d) 시간 초과를 넘긴 processing → 응답은 failed, DB 값은 processing 그대로
  (e) 이전 코디에 별점 → 정산 성공(rated), 정리 뒤 별점 코디 1벌만 남고 재추천 상태 null
끝나면 검증용 회원을 지운다(FK CASCADE). 개발 회원 데이터는 건드리지 않는다.

backend/ 폴더에서 실행한다 (docker DB와 마이그레이션·시드가 준비돼 있어야 한다):
    python scripts/regeneration_result_check.py
    python scripts/regeneration_result_check.py --keep
"""

from __future__ import annotations

import argparse
import asyncio
import sys
from datetime import datetime
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
from app.schemas.recommendation_result import OutfitResult, RecommendationResult  # noqa: E402
from app.services import recommendation_result as result_service  # noqa: E402
from app.services import (  # noqa: E402
    regeneration_generation,
    regeneration_save,
    session_cleanup,
)
from app.services.weather.base_time import KST  # noqa: E402
from scripts.regeneration_save_check import (  # noqa: E402
    CASUAL,
    WARMER,
    Seeded,
    feedback_types,
    insert_request,
    new_second_outfit,
    rate_without_cleanup,
    request_rows,
    run_pipeline,
    seed_member,
    seed_session,
    session_status,
)
from scripts.session_cleanup_check import expect  # noqa: E402
from scripts.settlement_concurrency import cleanup, report  # noqa: E402


class _Storage:
    def url(self, key: str) -> str:
        return f"/media/{key}"


async def get_result(factory, seeded: Seeded, member_id: int) -> RecommendationResult:
    async with factory() as db:
        return await result_service.get_recommendation_result(
            db, _Storage(), seeded.session_id, member_id, datetime.now(KST)
        )


async def new_outfit_ids(factory, seeded: Seeded) -> list[int]:
    async with factory() as db:
        rows = await db.execute(
            text(
                """
                SELECT o.outfit_id
                FROM outfit o
                JOIN recommendation_deck d ON d.recommendation_deck_id = o.recommendation_deck_id
                WHERE d.recommendation_session_id = :s AND d.deck_seq > 1
                ORDER BY d.deck_seq
                """
            ),
            {"s": seeded.session_id},
        )
        return [r.outfit_id for r in rows]


def screen(outfits: list[OutfitResult]) -> list[tuple]:
    return [(o.outfit_seq, o.outfit_id, [p.outfit_id for p in o.previous_outfits]) for o in outfits]


def regeneration_of(result: RecommendationResult) -> tuple | None:
    r = result.latest_regeneration
    if r is None:
        return None
    return (r.request_seq, r.regeneration_status_cd, r.target_scope_cd, r.target_outfit_id)


async def check_regenerated_twice(factory, member_ids: list[int]) -> tuple[bool, Seeded, int]:
    member_id, w = await seed_member(factory, member_ids)
    seeded = await seed_session(factory, member_id, w)
    first = await insert_request(factory, seeded.session_id, 1, "single", seeded.outfit2, CASUAL)
    await run_pipeline(first, w, [new_second_outfit(w)])
    [second_outfit] = await new_outfit_ids(factory, seeded)
    second = await insert_request(factory, seeded.session_id, 2, "single", second_outfit, WARMER)
    await run_pipeline(second, w, [new_second_outfit(w)])
    third_outfit = (await new_outfit_ids(factory, seeded))[-1]

    result = await get_result(factory, seeded, member_id)

    failures: list[str] = []
    expect(
        failures,
        "화면 (seq, 현재, 이전)",
        screen(result.outfits),
        [(1, seeded.outfit1, []), (2, third_outfit, [second_outfit, seeded.outfit2])],
    )
    expect(
        failures,
        "재추천 상태",
        regeneration_of(result),
        (2, "completed", "single", second_outfit),
    )
    previous = result.outfits[1].previous_outfits if len(result.outfits) == 2 else []
    oldest = previous[-1] if previous else None
    expect(
        failures,
        "가장 오래된 이전 코디 스타일",
        [i.style_cds for i in oldest.items] if oldest else None,
        [["street"], ["classic"], [w.essential_style_cd]],
    )
    ok = report("(a) 2번 두 번 재추천 → 현재 코디 + 이전 코디 2벌(최신순)", failures)
    return ok, seeded, member_id


async def check_failed_keeps_outfits(factory, member_ids: list[int]) -> bool:
    member_id, w = await seed_member(factory, member_ids)
    seeded = await seed_session(factory, member_id, w)
    request_id = await insert_request(
        factory, seeded.session_id, 1, "single", seeded.outfit2, CASUAL
    )
    await run_pipeline(request_id, w, [])

    result = await get_result(factory, seeded, member_id)

    failures: list[str] = []
    expect(
        failures,
        "화면 (seq, 현재, 이전)",
        screen(result.outfits),
        [(1, seeded.outfit1, []), (2, seeded.outfit2, [])],
    )
    expect(
        failures, "재추천 상태", regeneration_of(result), (1, "failed", "single", seeded.outfit2)
    )
    return report("(b) 재추천 실패 → failed, 현재 코디 그대로", failures)


async def check_latest_failed_after_completed(factory, member_ids: list[int]) -> bool:
    member_id, w = await seed_member(factory, member_ids)
    seeded = await seed_session(factory, member_id, w)
    first = await insert_request(factory, seeded.session_id, 1, "single", seeded.outfit2, CASUAL)
    await run_pipeline(first, w, [new_second_outfit(w)])
    [new_outfit] = await new_outfit_ids(factory, seeded)
    second = await insert_request(factory, seeded.session_id, 2, "all", None, WARMER)
    await run_pipeline(second, w, [])

    result = await get_result(factory, seeded, member_id)

    failures: list[str] = []
    expect(
        failures,
        "요청 (seq, 상태)",
        [r[:2] for r in await request_rows(factory, seeded.session_id)],
        [(1, "completed"), (2, "failed")],
    )
    expect(failures, "재추천 상태", regeneration_of(result), (2, "failed", "all", None))
    expect(
        failures,
        "화면 (seq, 현재, 이전)",
        screen(result.outfits),
        [(1, seeded.outfit1, []), (2, new_outfit, [seeded.outfit2])],
    )
    return report("(c) 앞 요청 completed + 최근 요청 failed → failed", failures)


async def check_timed_out_processing(factory, member_ids: list[int]) -> bool:
    timeout = get_settings().REGENERATION_PROCESSING_TIMEOUT_SECONDS
    member_id, w = await seed_member(factory, member_ids)
    seeded = await seed_session(factory, member_id, w)
    request_id = await insert_request(
        factory, seeded.session_id, 1, "single", seeded.outfit2, CASUAL
    )

    failures: list[str] = []
    fresh = await get_result(factory, seeded, member_id)
    expect(
        failures,
        "갓 들어온 요청",
        regeneration_of(fresh),
        (1, "processing", "single", seeded.outfit2),
    )

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

    stale = await get_result(factory, seeded, member_id)
    expect(
        failures, "시간 초과 요청", regeneration_of(stale), (1, "failed", "single", seeded.outfit2)
    )
    expect(
        failures,
        "DB 요청 (seq, 상태, 덱)",
        await request_rows(factory, seeded.session_id),
        [(1, "processing", None)],
    )
    return report("(d) 시간 초과 processing → 응답 failed, DB processing", failures)


async def check_rating_previous_outfit(factory, seeded: Seeded, member_id: int) -> bool:
    await rate_without_cleanup(factory, seeded.session_id, member_id, seeded.outfit2)

    failures: list[str] = []
    expect(failures, "세션 상태", await session_status(factory, seeded.session_id), "completed")
    feedbacks = await feedback_types(factory, seeded.session_id)
    expect(failures, "이전 코디 피드백", feedbacks.get(seeded.outfit2, (None,))[0], "rated")
    expect(failures, "피드백 수", len(feedbacks), 4)

    async with factory() as db:
        await session_cleanup.cleanup_ended_session(db, seeded.session_id)
    result = await get_result(factory, seeded, member_id)
    expect(failures, "정리 뒤 화면", screen(result.outfits), [(2, seeded.outfit2, [])])
    expect(failures, "정리 뒤 재추천 상태", result.latest_regeneration, None)
    return report("(e) 이전 코디에 별점 → 정산 성공, 정리 뒤 별점 코디 1벌", failures)


async def main() -> int:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawTextHelpFormatter
    )
    parser.add_argument("--keep", action="store_true", help="검증용 회원을 지우지 않고 남긴다")
    args = parser.parse_args()

    engine = create_async_engine(get_settings().DATABASE_URL, pool_size=5, max_overflow=0)
    factory = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)
    originals = (regeneration_save.AsyncSessionLocal, regeneration_generation.AsyncSessionLocal)
    regeneration_save.AsyncSessionLocal = factory
    regeneration_generation.AsyncSessionLocal = factory
    member_ids: list[int] = []
    try:
        ok_a, twice, twice_member_id = await check_regenerated_twice(factory, member_ids)
        results = [
            ok_a,
            await check_failed_keeps_outfits(factory, member_ids),
            await check_latest_failed_after_completed(factory, member_ids),
            await check_timed_out_processing(factory, member_ids),
            await check_rating_previous_outfit(factory, twice, twice_member_id),
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
