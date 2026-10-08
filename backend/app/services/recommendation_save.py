"""추천 결과 저장 (REC-16).

첫 덱(deck_seq 1, initial) → 코디 → 코디 아이템을 한 트랜잭션으로 저장하고, 같은 트랜잭션에서
세션의 generation_status_cd를 completed로 바꾼다. 아이템에는 이름·이미지 스냅샷을 남겨
옷이 나중에 지워져도 추천 당시대로 보이게 한다(FR-HIST-08).
"""

import logging
from collections.abc import Mapping, Sequence
from dataclasses import dataclass

from app.core.db import AsyncSessionLocal
from app.repositories import clothing as clothing_repo
from app.repositories import essential_item as essential_item_repo
from app.repositories import recommendation_deck as deck_repo
from app.repositories import recommendation_session as session_repo
from app.repositories.clothing import ClothingSnapshot
from app.repositories.essential_item import EssentialItemSnapshot
from app.repositories.recommendation_deck import OutfitItemRow
from app.services.essential_supplement import SupplementedCandidate, SupplementResult
from app.services.outfit_generator import DraftOutfit
from app.services.prompt.outfit_generation import CATEGORY_ORDER

logger = logging.getLogger(__name__)

INITIAL_DECK_SEQ = 1

_CATEGORY_LABELS = {
    "outer": "아우터",
    "top": "상의",
    "bottom": "하의",
    "shoes": "신발",
    "socks": "양말",
    "accessories": "악세서리",
}
_ACCESSORY_TYPE_LABELS = {
    "hat": "모자",
    "bag": "가방",
    "belt": "벨트",
    "watch": "시계",
    "scarf": "스카프",
    "eyewear": "안경",
    "jewelry": "주얼리",
    "etc": "악세서리",
}


class GenerationNotProcessingError(RuntimeError):
    """세션이 이미 processing이 아니라 결과를 저장하지 않는다."""


@dataclass(frozen=True)
class OutfitRow:
    outfit_seq: int
    outfit_type_cd: str
    reason: str | None
    items: tuple[OutfitItemRow, ...]


async def save_recommendation_result(
    recommendation_session_id: int,
    member_id: int,
    outfits: Sequence[DraftOutfit],
    supplement: SupplementResult,
) -> None:
    candidates_by_key = {c.key: c for c in supplement.candidates}
    used = [candidates_by_key[key] for o in outfits for key in o.item_keys]
    clothing_ids = sorted({c.item_id for c in used if c.source_cd == "owned"})
    essential_ids = sorted({c.item_id for c in used if c.source_cd == "essential"})

    async with AsyncSessionLocal() as db, db.begin():
        # 세션 행을 먼저 바꿔 잠가 둔다. 이미 끝난 세션이면 덱을 만들지 않고 롤백한다
        completed = await session_repo.complete_generation(
            db, recommendation_session_id, supplement.is_clothing_shortage
        )
        if not completed:
            raise GenerationNotProcessingError(recommendation_session_id)

        clothing_snapshots = await clothing_repo.get_clothing_snapshots(db, member_id, clothing_ids)
        essential_snapshots = await essential_item_repo.get_essential_item_snapshots(
            db, essential_ids
        )
        rows = build_outfit_rows(
            outfits, candidates_by_key, clothing_snapshots, essential_snapshots
        )

        deck_id = await deck_repo.insert_deck(
            db, recommendation_session_id, INITIAL_DECK_SEQ, "initial"
        )
        for row in rows:
            outfit_id = await deck_repo.insert_outfit(
                db, deck_id, row.outfit_seq, row.outfit_type_cd, row.reason
            )
            await deck_repo.insert_outfit_items(db, outfit_id, row.items)


async def mark_generation_failed(
    recommendation_session_id: int, is_clothing_shortage: bool | None = None
) -> None:
    """새 DB 세션에서 실패를 기록한다. 기록하다 실패해도 예외를 밖으로 던지지 않는다."""
    try:
        async with AsyncSessionLocal() as db, db.begin():
            changed = await session_repo.mark_generation_failed(
                db, recommendation_session_id, is_clothing_shortage
            )
    except Exception:
        logger.exception("recommend.mark_failed.failed session_id=%s", recommendation_session_id)
        return
    if not changed:
        logger.warning("recommend.mark_failed.skipped session_id=%s", recommendation_session_id)


def build_outfit_rows(
    outfits: Sequence[DraftOutfit],
    candidates_by_key: Mapping[str, SupplementedCandidate],
    clothing_snapshots: Mapping[int, ClothingSnapshot],
    essential_snapshots: Mapping[int, EssentialItemSnapshot],
) -> list[OutfitRow]:
    """생성 결과를 저장할 행으로 바꾼다. outfit_seq는 생성 결과 순서대로 1부터 다시 매긴다."""
    exploratory_count = sum(o.outfit_type == "exploratory" for o in outfits)
    if exploratory_count > 1:
        raise ValueError(f"탐색 코디가 {exploratory_count}벌입니다 (최대 1벌)")

    rows = []
    for seq, outfit in enumerate(outfits, start=1):
        candidates = sorted(
            (candidates_by_key[key] for key in outfit.item_keys),
            key=lambda c: CATEGORY_ORDER.index(c.category_cd),
        )
        items = tuple(_to_item_row(c, clothing_snapshots, essential_snapshots) for c in candidates)
        rows.append(OutfitRow(seq, outfit.outfit_type, outfit.reason, items))
    return rows


def _to_item_row(
    candidate: SupplementedCandidate,
    clothing_snapshots: Mapping[int, ClothingSnapshot],
    essential_snapshots: Mapping[int, EssentialItemSnapshot],
) -> OutfitItemRow:
    if candidate.source_cd == "owned":
        clothing = clothing_snapshots.get(candidate.item_id)
        if clothing is None:
            raise ValueError(f"저장할 옷을 찾을 수 없습니다: clothing_id={candidate.item_id}")
        return OutfitItemRow(
            slot_cd=candidate.category_cd,
            item_source_cd="owned",
            clothing_id=candidate.item_id,
            essential_item_id=None,
            item_name_snapshot=clothing.item_name or _fallback_name(candidate, clothing),
            image_url_snapshot=clothing.cutout_image_url or clothing.origin_image_url,
        )

    essential = essential_snapshots.get(candidate.item_id)
    if essential is None:
        raise ValueError(
            f"저장할 에센셜 의류를 찾을 수 없습니다: essential_item_id={candidate.item_id}"
        )
    return OutfitItemRow(
        slot_cd=candidate.category_cd,
        item_source_cd="essential",
        clothing_id=None,
        essential_item_id=candidate.item_id,
        item_name_snapshot=essential.item_name,
        image_url_snapshot=essential.image_url,
    )


def _fallback_name(candidate: SupplementedCandidate, clothing: ClothingSnapshot) -> str:
    if candidate.category_cd == "accessories" and candidate.accessory_type_cd is not None:
        label = _ACCESSORY_TYPE_LABELS[candidate.accessory_type_cd]
    else:
        label = _CATEGORY_LABELS[candidate.category_cd]
    return f"{clothing.color_nm} {label}" if clothing.color_nm else label
