"""추천 결과 조회 (REC-17)."""

from collections.abc import Mapping, Sequence
from datetime import datetime
from decimal import Decimal
from typing import Any, Protocol

from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories import recommendation_result as result_repo
from app.repositories import regeneration_request as regeneration_repo
from app.repositories.recommendation_result import OutfitItemResultRow
from app.repositories.regeneration_request import LatestRequestRow
from app.schemas.recommendation_result import (
    LatestRegeneration,
    OutfitItemResult,
    OutfitResult,
    PreviousOutfitResult,
    RecommendationResult,
    SessionCondition,
    SessionWeather,
)
from app.services.prompt.outfit_generation import CATEGORY_ORDER
from app.services.recommendation_session import from_db_utc
from app.services.regeneration_request import processing_stale_before
from app.services.session_errors import SessionNotFoundError
from app.services.storage import ImageStorage


class WeatherColumns(Protocol):
    @property
    def has_weather(self) -> bool: ...

    @property
    def temperature(self) -> Decimal | None: ...

    @property
    def feels_like_temperature(self) -> Decimal | None: ...

    @property
    def weather_condition_cd(self) -> str | None: ...

    @property
    def is_weather_fallback(self) -> bool | None: ...


async def get_recommendation_result(
    db: AsyncSession,
    storage: ImageStorage,
    recommendation_session_id: int,
    member_id: int,
    now: datetime,
) -> RecommendationResult:
    session = await result_repo.get_session(db, recommendation_session_id)
    if session is None or session.member_id != member_id:
        raise SessionNotFoundError()

    outfits: list[OutfitResult] = []
    if session.generation_status_cd == "completed":
        rows = await result_repo.get_outfit_items(db, recommendation_session_id)
        clothing_ids = sorted({r.clothing_id for r in rows if r.clothing_id is not None})
        styles = await result_repo.get_clothing_styles(db, clothing_ids)
        outfits = build_outfits(rows, styles, storage)

    latest_regeneration = None
    # 별점 정산 뒤 정리는 별도 트랜잭션이라 끝난 세션에도 요청 행이 남아 있을 수 있다
    if session.session_status_cd == "active" and session.generation_status_cd == "completed":
        request = await regeneration_repo.find_latest_request(db, recommendation_session_id)
        latest_regeneration = _to_latest_regeneration(request, processing_stale_before(now))

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
        weather=to_session_weather(session),
        outfits=outfits,
        latest_regeneration=latest_regeneration,
    )


def latest_deck_rows(rows: Sequence[OutfitItemResultRow]) -> list[OutfitItemResultRow]:
    latest_deck_by_seq: dict[int, int] = {}
    for row in rows:
        latest_deck_by_seq[row.outfit_seq] = max(
            row.deck_seq, latest_deck_by_seq.get(row.outfit_seq, row.deck_seq)
        )
    return [row for row in rows if row.deck_seq == latest_deck_by_seq[row.outfit_seq]]


def build_outfits(
    rows: Sequence[OutfitItemResultRow],
    styles_by_clothing: Mapping[int, Sequence[str]],
    storage: ImageStorage,
) -> list[OutfitResult]:
    items_by_outfit: dict[int, list[OutfitItemResultRow]] = {}
    for row in rows:
        items_by_outfit.setdefault(row.outfit_id, []).append(row)

    outfits_by_seq: dict[int, list[list[OutfitItemResultRow]]] = {}
    for items in items_by_outfit.values():
        outfits_by_seq.setdefault(items[0].outfit_seq, []).append(items)

    outfits = []
    for outfit_seq in sorted(outfits_by_seq):
        latest, *previous = sorted(
            outfits_by_seq[outfit_seq], key=lambda items: items[0].deck_seq, reverse=True
        )
        outfits.append(
            OutfitResult(
                **_outfit_fields(latest, styles_by_clothing, storage),
                previous_outfits=[
                    PreviousOutfitResult(**_outfit_fields(items, styles_by_clothing, storage))
                    for items in previous
                ],
            )
        )
    return outfits


def _outfit_fields(
    items: Sequence[OutfitItemResultRow],
    styles_by_clothing: Mapping[int, Sequence[str]],
    storage: ImageStorage,
) -> dict[str, Any]:
    first = items[0]
    ordered = sorted(items, key=lambda r: (CATEGORY_ORDER.index(r.slot_cd), r.outfit_item_id))
    return {
        "outfit_id": first.outfit_id,
        "outfit_seq": first.outfit_seq,
        "outfit_type_cd": first.outfit_type_cd,
        "reason": first.reason,
        "items": [
            OutfitItemResult(**outfit_item_fields(r, styles_by_clothing, storage)) for r in ordered
        ],
    }


def _to_latest_regeneration(
    request: LatestRequestRow | None, stale_before: datetime
) -> LatestRegeneration | None:
    if request is None:
        return None
    status_cd = request.regeneration_status_cd
    # DB는 다음 재추천 요청이 올 때 failed로 바뀐다. 조회는 응답만 바꾸며,
    # 저장은 시간 초과를 보지 않아 나중에 completed가 될 수 있다
    if status_cd == "processing" and request.created_at < stale_before:
        status_cd = "failed"
    return LatestRegeneration(
        request_seq=request.request_seq,
        regeneration_status_cd=status_cd,
        target_scope_cd=request.target_scope_cd,
        target_outfit_id=request.target_outfit_id,
        target_slot_cd=request.target_slot_cd,
    )


def outfit_item_fields(
    row: OutfitItemResultRow,
    styles_by_clothing: Mapping[int, Sequence[str]],
    storage: ImageStorage,
) -> dict[str, Any]:
    if row.item_source_cd == "essential":
        style_cds = [row.essential_style_cd] if row.essential_style_cd else []
    else:
        style_cds = list(styles_by_clothing.get(row.clothing_id, [])) if row.clothing_id else []
    return {
        "slot_cd": row.slot_cd,
        "accessory_type_cd": row.accessory_type_cd,
        "item_source_cd": row.item_source_cd,
        "item_name": row.item_name_snapshot,
        "image_url": storage.url(row.image_url_snapshot) if row.image_url_snapshot else None,
        "style_cds": style_cds,
    }


def to_session_weather(row: WeatherColumns) -> SessionWeather | None:
    if not row.has_weather:
        return None
    return SessionWeather(
        temperature=float(row.temperature),
        feels_like_temperature=float(row.feels_like_temperature),
        weather_condition_cd=row.weather_condition_cd,
        is_fallback=bool(row.is_weather_fallback),
    )
