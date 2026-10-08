"""추천 결과 조회 (REC-17)."""

from collections import defaultdict
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal

from sqlalchemy import bindparam, text
from sqlalchemy.ext.asyncio import AsyncSession


@dataclass(frozen=True)
class ResultSessionRow:
    member_id: int
    generation_status_cd: str
    session_status_cd: str
    is_clothing_shortage: bool
    tpo_cd: str
    tpo_text: str | None
    season_cd: str
    going_out_start_at: datetime
    going_out_end_at: datetime
    temperature: Decimal | None
    feels_like_temperature: Decimal | None
    weather_condition_cd: str | None
    is_weather_fallback: bool | None


@dataclass(frozen=True)
class OutfitItemResultRow:
    deck_seq: int
    outfit_id: int
    outfit_seq: int
    outfit_type_cd: str
    reason: str | None
    outfit_item_id: int
    slot_cd: str
    item_source_cd: str
    clothing_id: int | None
    item_name_snapshot: str
    image_url_snapshot: str | None
    accessory_type_cd: str | None
    essential_style_cd: str | None


SESSION_SQL = text(
    """
    SELECT s.member_id, s.generation_status_cd, s.session_status_cd, s.is_clothing_shortage,
           s.tpo_cd, s.tpo_text, s.season_cd, s.going_out_start_at, s.going_out_end_at,
           w.temperature, w.feels_like_temperature, w.weather_condition_cd,
           w.is_fallback AS is_weather_fallback
    FROM recommendation_session s
    LEFT JOIN weather_snapshot w ON w.recommendation_session_id = s.recommendation_session_id
    WHERE s.recommendation_session_id = :recommendation_session_id
    """
)

OUTFIT_ITEMS_SQL = text(
    """
    SELECT d.deck_seq, o.outfit_id, o.outfit_seq, o.outfit_type_cd, o.reason,
           i.outfit_item_id, i.slot_cd, i.item_source_cd, i.clothing_id,
           i.item_name_snapshot, i.image_url_snapshot,
           COALESCE(c.accessory_type_cd, e.accessory_type_cd) AS accessory_type_cd,
           e.style_cd AS essential_style_cd
    FROM recommendation_deck d
    JOIN outfit o ON o.recommendation_deck_id = d.recommendation_deck_id
    JOIN outfit_item i ON i.outfit_id = o.outfit_id
    LEFT JOIN clothing c ON c.clothing_id = i.clothing_id
    LEFT JOIN essential_item e ON e.essential_item_id = i.essential_item_id
    WHERE d.recommendation_session_id = :recommendation_session_id
    ORDER BY d.deck_seq, o.outfit_seq, i.outfit_item_id
    """
)

CLOTHING_STYLES_SQL = text(
    """
    SELECT clothing_id, style_cd
    FROM clothing_style
    WHERE clothing_id IN :clothing_ids
    ORDER BY clothing_id, clothing_style_id
    """
).bindparams(bindparam("clothing_ids", expanding=True))


async def get_session(db: AsyncSession, recommendation_session_id: int) -> ResultSessionRow | None:
    row = (
        await db.execute(SESSION_SQL, {"recommendation_session_id": recommendation_session_id})
    ).first()
    if row is None:
        return None
    return ResultSessionRow(
        member_id=row.member_id,
        generation_status_cd=row.generation_status_cd,
        session_status_cd=row.session_status_cd,
        is_clothing_shortage=bool(row.is_clothing_shortage),
        tpo_cd=row.tpo_cd,
        tpo_text=row.tpo_text,
        season_cd=row.season_cd,
        going_out_start_at=row.going_out_start_at,
        going_out_end_at=row.going_out_end_at,
        temperature=row.temperature,
        feels_like_temperature=row.feels_like_temperature,
        weather_condition_cd=row.weather_condition_cd,
        is_weather_fallback=(
            bool(row.is_weather_fallback) if row.is_weather_fallback is not None else None
        ),
    )


async def get_outfit_items(
    db: AsyncSession, recommendation_session_id: int
) -> list[OutfitItemResultRow]:
    rows = (
        await db.execute(OUTFIT_ITEMS_SQL, {"recommendation_session_id": recommendation_session_id})
    ).all()
    return [
        OutfitItemResultRow(
            deck_seq=row.deck_seq,
            outfit_id=row.outfit_id,
            outfit_seq=row.outfit_seq,
            outfit_type_cd=row.outfit_type_cd,
            reason=row.reason,
            outfit_item_id=row.outfit_item_id,
            slot_cd=row.slot_cd,
            item_source_cd=row.item_source_cd,
            clothing_id=row.clothing_id,
            item_name_snapshot=row.item_name_snapshot,
            image_url_snapshot=row.image_url_snapshot,
            accessory_type_cd=row.accessory_type_cd,
            essential_style_cd=row.essential_style_cd,
        )
        for row in rows
    ]


async def get_clothing_styles(
    db: AsyncSession, clothing_ids: Sequence[int]
) -> dict[int, list[str]]:
    if not clothing_ids:
        return {}
    rows = (await db.execute(CLOTHING_STYLES_SQL, {"clothing_ids": list(clothing_ids)})).all()
    styles: dict[int, list[str]] = defaultdict(list)
    for row in rows:
        styles[row.clothing_id].append(row.style_cd)
    return dict(styles)
