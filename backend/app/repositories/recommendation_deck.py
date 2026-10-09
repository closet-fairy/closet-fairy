"""추천 결과(덱·코디·코디 아이템) 저장 (REC-16). commit은 호출자가 한다."""

from collections.abc import Sequence
from dataclasses import dataclass

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


@dataclass(frozen=True)
class OutfitItemRow:
    slot_cd: str
    item_source_cd: str
    clothing_id: int | None
    essential_item_id: int | None
    item_name_snapshot: str
    image_url_snapshot: str | None


INSERT_DECK_SQL = text(
    """
    INSERT INTO recommendation_deck (recommendation_session_id, deck_seq, deck_trigger_cd)
    VALUES (:recommendation_session_id, :deck_seq, :deck_trigger_cd)
    """
)

INSERT_OUTFIT_SQL = text(
    """
    INSERT INTO outfit (recommendation_deck_id, outfit_seq, outfit_type_cd, reason)
    VALUES (:recommendation_deck_id, :outfit_seq, :outfit_type_cd, :reason)
    """
)

INSERT_OUTFIT_ITEM_SQL = text(
    """
    INSERT INTO outfit_item (
        outfit_id, slot_cd, item_source_cd, clothing_id, essential_item_id,
        item_name_snapshot, image_url_snapshot
    ) VALUES (
        :outfit_id, :slot_cd, :item_source_cd, :clothing_id, :essential_item_id,
        :item_name_snapshot, :image_url_snapshot
    )
    """
)


async def insert_deck(
    db: AsyncSession, recommendation_session_id: int, deck_seq: int, deck_trigger_cd: str
) -> int:
    result = await db.execute(
        INSERT_DECK_SQL,
        {
            "recommendation_session_id": recommendation_session_id,
            "deck_seq": deck_seq,
            "deck_trigger_cd": deck_trigger_cd,
        },
    )
    return int(result.lastrowid)


async def insert_outfit(
    db: AsyncSession,
    recommendation_deck_id: int,
    outfit_seq: int,
    outfit_type_cd: str,
    reason: str | None,
) -> int:
    result = await db.execute(
        INSERT_OUTFIT_SQL,
        {
            "recommendation_deck_id": recommendation_deck_id,
            "outfit_seq": outfit_seq,
            "outfit_type_cd": outfit_type_cd,
            "reason": reason,
        },
    )
    return int(result.lastrowid)


async def insert_outfit_items(
    db: AsyncSession, outfit_id: int, items: Sequence[OutfitItemRow]
) -> None:
    await db.execute(
        INSERT_OUTFIT_ITEM_SQL,
        [
            {
                "outfit_id": outfit_id,
                "slot_cd": item.slot_cd,
                "item_source_cd": item.item_source_cd,
                "clothing_id": item.clothing_id,
                "essential_item_id": item.essential_item_id,
                "item_name_snapshot": item.item_name_snapshot,
                "image_url_snapshot": item.image_url_snapshot,
            }
            for item in items
        ],
    )


SELECT_SESSION_OUTFIT_IDS_SQL = text(
    """
    SELECT o.outfit_id
    FROM outfit o
    JOIN recommendation_deck d ON d.recommendation_deck_id = o.recommendation_deck_id
    WHERE d.recommendation_session_id = :recommendation_session_id
    ORDER BY d.deck_seq, o.outfit_seq
    """
)


async def find_session_outfit_ids(db: AsyncSession, recommendation_session_id: int) -> list[int]:
    result = await db.execute(
        SELECT_SESSION_OUTFIT_IDS_SQL, {"recommendation_session_id": recommendation_session_id}
    )
    return [int(r.outfit_id) for r in result]


DELETE_OUTFITS_EXCEPT_SQL = text(
    """
    DELETE o FROM outfit o
    JOIN recommendation_deck d ON d.recommendation_deck_id = o.recommendation_deck_id
    WHERE d.recommendation_session_id = :recommendation_session_id
      AND o.outfit_id <> :keep_outfit_id
    """
)

DELETE_EMPTY_DECKS_SQL = text(
    """
    DELETE d FROM recommendation_deck d
    LEFT JOIN outfit o ON o.recommendation_deck_id = d.recommendation_deck_id
    WHERE d.recommendation_session_id = :recommendation_session_id
      AND o.outfit_id IS NULL
    """
)

DELETE_SESSION_DECKS_SQL = text(
    """
    DELETE FROM recommendation_deck
    WHERE recommendation_session_id = :recommendation_session_id
    """
)


async def delete_outfits_except(
    db: AsyncSession, recommendation_session_id: int, keep_outfit_id: int
) -> int:
    result = await db.execute(
        DELETE_OUTFITS_EXCEPT_SQL,
        {"recommendation_session_id": recommendation_session_id, "keep_outfit_id": keep_outfit_id},
    )
    return result.rowcount


async def delete_empty_decks(db: AsyncSession, recommendation_session_id: int) -> int:
    result = await db.execute(
        DELETE_EMPTY_DECKS_SQL, {"recommendation_session_id": recommendation_session_id}
    )
    return result.rowcount


async def delete_session_decks(db: AsyncSession, recommendation_session_id: int) -> int:
    result = await db.execute(
        DELETE_SESSION_DECKS_SQL, {"recommendation_session_id": recommendation_session_id}
    )
    return result.rowcount
