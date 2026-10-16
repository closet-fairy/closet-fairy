"""재추천 요청 접수 검증 스크립트 (#85). 실제 MySQL에 붙고 LLM은 고정 응답으로 바꾼다.

검증용 회원·옷·세션·덱·코디를 SQL로 직접 넣고 접수 서비스를 호출한다.
  (a) 정상 요청: processing 1행, request_seq 1, parsed_intent 복원 가능, 공백 제거된 원문
  (b) 재생성 중 두 번째 요청: 거부되고 행이 늘지 않음
  (c) 시간 초과된 processing: failed로 바뀌고 새 요청이 request_seq 2로 기록됨
  (d) 이전 덱 코디 대상 → 거부, 다른 세션 코디 대상 → 거부, 이해 못 함·길이 초과 → 기록 없음
  (e) 같은 세션에 동시 요청 → 하나만 기록
끝나면 검증용 회원을 지운다(FK CASCADE). 개발 회원 데이터는 건드리지 않는다.

backend/ 폴더에서 실행한다 (docker DB와 007까지의 마이그레이션·시드가 준비돼 있어야 한다):
    python scripts/regeneration_request_check.py
    python scripts/regeneration_request_check.py --concurrency 20 --keep
"""

from __future__ import annotations

import argparse
import asyncio
import json
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
from app.schemas.regeneration_request import RegenerationCreate  # noqa: E402
from app.services import regeneration_request as service  # noqa: E402
from app.services.regeneration_intent import RegenerationIntent  # noqa: E402
from app.services.session_errors import OutfitNotInSessionError  # noqa: E402
from app.services.weather.base_time import KST  # noqa: E402
from scripts.session_cleanup_check import expect, seed_member, seed_session  # noqa: E402
from scripts.settlement_concurrency import cleanup, count, report, warm_up_pool  # noqa: E402

OK_OUTPUT = {
    "status": "ok",
    "preferred_styles": ["casual"],
    "avoided_styles": [],
    "preferred_colors": [],
    "avoided_colors": [],
    "replace_items": [{"slot": "bottom", "item_name": "청바지"}],
    "clothing_warmth": None,
}


class StubLLM:
    def __init__(self, output: dict, delay_s: float = 0.0) -> None:
        self._output = output
        self._delay_s = delay_s

    async def call_structured(self, config, system, messages, output_model):
        await asyncio.sleep(self._delay_s)
        return output_model.model_validate(self._output)


async def latest_outfit_id(factory, session_id: int) -> int:
    async with factory() as db:
        return int(
            (
                await db.execute(
                    text(
                        """
                        SELECT o.outfit_id
                        FROM outfit o
                        JOIN recommendation_deck d
                          ON d.recommendation_deck_id = o.recommendation_deck_id
                        WHERE d.recommendation_session_id = :s AND d.deck_seq = 2
                        """
                    ),
                    {"s": session_id},
                )
            ).scalar_one()
        )


async def request_rows(factory, session_id: int) -> list:
    async with factory() as db:
        return (
            await db.execute(
                text(
                    """
                    SELECT request_seq, target_scope_cd, target_outfit_id, target_slot_cd,
                           request_text, parsed_intent, regeneration_status_cd
                    FROM regeneration_request
                    WHERE recommendation_session_id = :s
                    ORDER BY request_seq
                    """
                ),
                {"s": session_id},
            )
        ).all()


async def request(factory, session_id: int, member_id: int, req: RegenerationCreate, llm=None):
    async with factory() as db:
        return await service.request_regeneration(
            db, llm or StubLLM(OK_OUTPUT), session_id, member_id, req, datetime.now(KST)
        )


async def expect_rejected(failures, name: str, error: type[Exception], call) -> None:
    try:
        await call
    except error:
        return
    except Exception as e:
        failures.append(f"{name}: {error.__name__} 대신 {type(e).__name__}")
        return
    failures.append(f"{name}: 거부되지 않음")


async def check_accept_and_timeout(factory, member_ids: list[int]) -> list[bool]:
    member_id, wardrobe = await seed_member(factory, member_ids)
    seeded = await seed_session(factory, member_id, wardrobe)
    session_id = seeded.session_id
    target = await latest_outfit_id(factory, session_id)

    failures: list[str] = []
    accepted = await request(
        factory,
        session_id,
        member_id,
        RegenerationCreate(
            request_text="  청바지로 바꿔 줘 ",
            target_scope_cd="single",
            target_outfit_id=target,
            target_slot_cd="bottom",
        ),
    )
    rows = await request_rows(factory, session_id)
    expect(failures, "요청 순번", accepted.request_seq, 1)
    expect(
        failures,
        "기록된 행",
        [(r.request_seq, r.target_scope_cd, r.target_outfit_id, r.target_slot_cd) for r in rows],
        [(1, "single", target, "bottom")],
    )
    if rows:
        expect(failures, "원문", rows[0].request_text, "청바지로 바꿔 줘")
        expect(failures, "상태", rows[0].regeneration_status_cd, "processing")
        restored = RegenerationIntent.from_dict(json.loads(rows[0].parsed_intent))
        expect(failures, "parsed_intent 복원", restored.replace_items, {"bottom": "청바지"})
    results = [report("(a) 정상 요청: processing 1행", failures)]

    failures = []
    await expect_rejected(
        failures,
        "재생성 중 요청",
        service.RegenerationInProgressError,
        request(
            factory,
            session_id,
            member_id,
            RegenerationCreate(request_text="전체 다시", target_scope_cd="all"),
        ),
    )
    expect(failures, "행 수", len(await request_rows(factory, session_id)), 1)
    results.append(report("(b) 재생성 중 두 번째 요청 거부", failures))

    failures = []
    timeout_s = get_settings().REGENERATION_PROCESSING_TIMEOUT_SECONDS
    async with factory() as db, db.begin():
        await db.execute(
            text(
                """
                UPDATE regeneration_request
                SET created_at = created_at - INTERVAL :seconds SECOND
                WHERE recommendation_session_id = :s
                """
            ),
            {"s": session_id, "seconds": timeout_s + 1},
        )
    accepted = await request(
        factory,
        session_id,
        member_id,
        RegenerationCreate(request_text="전체 다시", target_scope_cd="all"),
    )
    rows = await request_rows(factory, session_id)
    expect(failures, "요청 순번", accepted.request_seq, 2)
    expect(
        failures,
        "상태",
        [(r.request_seq, r.target_scope_cd, r.regeneration_status_cd) for r in rows],
        [(1, "single", "failed"), (2, "all", "processing")],
    )
    results.append(report(f"(c) {timeout_s}초 지난 processing → failed 후 새 요청", failures))
    return results


async def check_rejections(factory, member_ids: list[int]) -> bool:
    member_id, wardrobe = await seed_member(factory, member_ids)
    seeded = await seed_session(factory, member_id, wardrobe)
    other = await seed_session(factory, member_id, wardrobe)
    session_id = seeded.session_id

    def single(outfit_id: int, text_: str = "좀 더 캐주얼하게") -> RegenerationCreate:
        return RegenerationCreate(
            request_text=text_, target_scope_cd="single", target_outfit_id=outfit_id
        )

    failures: list[str] = []
    await expect_rejected(
        failures,
        "이전 덱 코디",
        service.RegenerationTargetNotLatestError,
        request(factory, session_id, member_id, single(seeded.rated_outfit_id)),
    )
    await expect_rejected(
        failures,
        "다른 세션 코디",
        OutfitNotInSessionError,
        request(
            factory,
            session_id,
            member_id,
            single(await latest_outfit_id(factory, other.session_id)),
        ),
    )
    await expect_rejected(
        failures,
        "이해 못 함",
        service.RegenerationRequestUnclearError,
        request(
            factory,
            session_id,
            member_id,
            RegenerationCreate(request_text="오늘 점심 뭐 먹지", target_scope_cd="all"),
            StubLLM({**OK_OUTPUT, "status": "unclear"}),
        ),
    )
    max_length = get_settings().REGENERATION_REQUEST_MAX_LENGTH
    await expect_rejected(
        failures,
        "길이 초과",
        service.RegenerationRequestTooLongError,
        request(
            factory,
            session_id,
            member_id,
            RegenerationCreate(request_text="가" * (max_length + 1), target_scope_cd="all"),
        ),
    )
    expect(failures, "행 수", len(await request_rows(factory, session_id)), 0)
    return report("(d) 대상·입력 거부는 기록 없음", failures)


async def check_concurrent_requests(factory, n: int, member_ids: list[int]) -> bool:
    member_id, wardrobe = await seed_member(factory, member_ids)
    seeded = await seed_session(factory, member_id, wardrobe)
    barrier = asyncio.Barrier(n)
    outcomes: list[str] = []

    async def one() -> None:
        await barrier.wait()
        try:
            await request(
                factory,
                seeded.session_id,
                member_id,
                RegenerationCreate(request_text="전체 다시", target_scope_cd="all"),
                StubLLM(OK_OUTPUT, delay_s=0.05),
            )
            outcomes.append("ok")
        except Exception as e:
            outcomes.append(type(e).__name__)

    await asyncio.gather(*(one() for _ in range(n)))

    failures: list[str] = []
    expect(failures, "접수 수", outcomes.count("ok"), 1)
    expect(
        failures,
        "거부 종류",
        {o for o in outcomes if o != "ok"},
        {"RegenerationInProgressError"},
    )
    rows = await count(
        factory,
        "SELECT COUNT(*) FROM regeneration_request WHERE recommendation_session_id = :s",
        {"s": seeded.session_id},
    )
    expect(failures, "행 수", rows, 1)
    return report(f"(e) 같은 세션 동시 요청 {n}건 → 1건만 기록", failures)


async def main() -> int:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawTextHelpFormatter
    )
    parser.add_argument("--concurrency", type=int, default=10, help="동시 요청 수 (기본 10)")
    parser.add_argument("--keep", action="store_true", help="검증용 회원을 지우지 않고 남긴다")
    args = parser.parse_args()

    engine = create_async_engine(
        get_settings().DATABASE_URL, pool_size=args.concurrency + 5, max_overflow=0
    )
    factory = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)
    member_ids: list[int] = []
    try:
        await warm_up_pool(engine, args.concurrency)
        results = [
            *await check_accept_and_timeout(factory, member_ids),
            await check_rejections(factory, member_ids),
            await check_concurrent_requests(factory, args.concurrency, member_ids),
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
