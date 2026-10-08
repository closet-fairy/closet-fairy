"""추천 결과 조회 (REC-17)."""

from collections.abc import Mapping, Sequence
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import NotFoundError
from app.repositories import recommendation_result as result_repo
from app.repositories.recommendation_result import OutfitItemResultRow, ResultSessionRow
from app.schemas.recommendation_result import (
    OutfitItemResult,
    OutfitResult,
    RecommendationResult,
    SessionCondition,
    SessionWeather,
)
from app.services.prompt.outfit_generation import CATEGORY_ORDER
from app.services.weather.base_time import KST


class RecommendationSessionNotFoundError(NotFoundError):
    message = "추천 세션을 찾을 수 없습니다."


async def get_recommendation_result(
    db: AsyncSession, recommendation_session_id: int, member_id: int
) -> RecommendationResult:
    session = await result_repo.get_session(db, recommendation_session_id)
    if session is None or session.member_id != member_id:
        raise RecommendationSessionNotFoundError()

    outfits: list[OutfitResult] = []
    if session.generation_status_cd == "completed":
        rows = await result_repo.get_outfit_items(db, recommendation_session_id)
        clothing_ids = sorted({r.clothing_id for r in rows if r.clothing_id is not None})
        styles = await result_repo.get_clothing_styles(db, clothing_ids)
        outfits = build_outfits(rows, styles)

    return RecommendationResult(
        recommendation_session_id=recommendation_session_id,
        generation_status_cd=session.generation_status_cd,
        session_status_cd=session.session_status_cd,
        is_clothing_shortage=session.is_clothing_shortage,
        condition=SessionCondition(
            tpo_cd=session.tpo_cd,
            tpo_text=session.tpo_text,
            season_cd=session.season_cd,
            going_out_start_at=from_db_utc(session.going_out_start_at),
            going_out_end_at=from_db_utc(session.going_out_end_at),
        ),
        weather=_to_weather(session),
        outfits=outfits,
    )


def build_outfits(
    rows: Sequence[OutfitItemResultRow], styles_by_clothing: Mapping[int, Sequence[str]]
) -> list[OutfitResult]:
    latest_deck_by_seq: dict[int, int] = {}
    for row in rows:
        latest_deck_by_seq[row.outfit_seq] = max(
            row.deck_seq, latest_deck_by_seq.get(row.outfit_seq, row.deck_seq)
        )

    items_by_outfit: dict[int, list[OutfitItemResultRow]] = {}
    for row in rows:
        if row.deck_seq == latest_deck_by_seq[row.outfit_seq]:
            items_by_outfit.setdefault(row.outfit_id, []).append(row)

    outfits = []
    for items in items_by_outfit.values():
        first = items[0]
        ordered = sorted(items, key=lambda r: (CATEGORY_ORDER.index(r.slot_cd), r.outfit_item_id))
        outfits.append(
            OutfitResult(
                outfit_id=first.outfit_id,
                outfit_seq=first.outfit_seq,
                outfit_type_cd=first.outfit_type_cd,
                reason=first.reason,
                items=[_to_item(r, styles_by_clothing) for r in ordered],
            )
        )
    return sorted(outfits, key=lambda o: o.outfit_seq)


def from_db_utc(dt: datetime) -> datetime:
    return dt.replace(tzinfo=timezone.utc).astimezone(KST)


def _to_item(
    row: OutfitItemResultRow, styles_by_clothing: Mapping[int, Sequence[str]]
) -> OutfitItemResult:
    if row.item_source_cd == "essential":
        style_cds = [row.essential_style_cd] if row.essential_style_cd else []
    else:
        style_cds = list(styles_by_clothing.get(row.clothing_id, [])) if row.clothing_id else []
    return OutfitItemResult(
        slot_cd=row.slot_cd,
        accessory_type_cd=row.accessory_type_cd,
        item_source_cd=row.item_source_cd,
        item_name=row.item_name_snapshot,
        image_url=row.image_url_snapshot,
        style_cds=style_cds,
    )


def _to_weather(session: ResultSessionRow) -> SessionWeather | None:
    if session.temperature is None:
        return None
    return SessionWeather(
        temperature=float(session.temperature),
        feels_like_temperature=float(session.feels_like_temperature),
        weather_condition_cd=session.weather_condition_cd,
        is_fallback=bool(session.is_weather_fallback),
    )
