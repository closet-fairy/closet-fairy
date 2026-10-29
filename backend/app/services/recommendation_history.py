"""추천 내역 목록·상세 조회 (#173, #174)."""

from collections.abc import Sequence
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories import recommendation_history as history_repo
from app.repositories import recommendation_result as result_repo
from app.repositories.recommendation_history import (
    HistoryDetailRow,
    HistorySessionRow,
    HistoryThumbnailRow,
)
from app.schemas.recommendation_history import (
    RecommendationHistoryCondition,
    RecommendationHistoryDetail,
    RecommendationHistoryItem,
    RecommendationHistoryOutfit,
    RecommendationHistoryOutfitItem,
    RecommendationHistoryPage,
    RecommendationHistoryThumbnail,
    RecommendationHistoryWeather,
)
from app.services.prompt.outfit_generation import CATEGORY_ORDER
from app.services.recommendation_result import outfit_item_fields, to_session_weather
from app.services.recommendation_session import from_db_utc
from app.services.session_errors import SessionNotFoundError
from app.services.storage import ImageStorage


async def get_history_page(
    db: AsyncSession, storage: ImageStorage, member_id: int, cursor: int | None, limit: int
) -> RecommendationHistoryPage:
    rows = await history_repo.get_history_page(db, member_id, cursor, limit + 1)
    has_more = len(rows) > limit
    rows = rows[:limit]
    thumbnail_rows = await history_repo.get_thumbnails(db, [r.rated_outfit_id for r in rows])
    thumbnails_by_outfit: dict[int, list[HistoryThumbnailRow]] = {}
    for thumbnail in thumbnail_rows:
        thumbnails_by_outfit.setdefault(thumbnail.outfit_id, []).append(thumbnail)
    return RecommendationHistoryPage(
        items=[
            _to_item(row, thumbnails_by_outfit.get(row.rated_outfit_id, []), storage)
            for row in rows
        ],
        next_cursor=rows[-1].recommendation_session_id if has_more else None,
    )


async def get_history_detail(
    db: AsyncSession, storage: ImageStorage, member_id: int, recommendation_session_id: int
) -> RecommendationHistoryDetail:
    row = await history_repo.get_history_detail(db, member_id, recommendation_session_id)
    if row is None:
        raise SessionNotFoundError()
    items = [
        r
        for r in await result_repo.get_outfit_items(db, recommendation_session_id)
        # 별점 정산 뒤 정리는 별도 트랜잭션이라 다른 코디가 아직 남아 있을 수 있다
        if r.outfit_id == row.rated_outfit_id
    ]
    clothing_ids = sorted({r.clothing_id for r in items if r.clothing_id is not None})
    styles = await result_repo.get_clothing_styles(db, clothing_ids)
    ordered = sorted(items, key=lambda r: (CATEGORY_ORDER.index(r.slot_cd), r.outfit_item_id))
    return RecommendationHistoryDetail(
        **_history_fields(row),
        weather=_to_detail_weather(row),
        outfit=RecommendationHistoryOutfit(
            outfit_type_cd=row.outfit_type_cd,
            reason=row.reason,
            items=[
                RecommendationHistoryOutfitItem(
                    **outfit_item_fields(r, styles, storage),
                    is_clothing_deleted=r.item_source_cd == "owned" and r.clothing_id is None,
                )
                for r in ordered
            ],
        ),
    )


def _to_item(
    row: HistorySessionRow, thumbnails: Sequence[HistoryThumbnailRow], storage: ImageStorage
) -> RecommendationHistoryItem:
    ordered = sorted(thumbnails, key=lambda t: (CATEGORY_ORDER.index(t.slot_cd), t.outfit_item_id))
    return RecommendationHistoryItem(
        **_history_fields(row),
        weather=to_session_weather(row),
        thumbnails=[
            RecommendationHistoryThumbnail(
                slot_cd=t.slot_cd,
                item_name=t.item_name_snapshot,
                image_url=storage.url(t.image_url_snapshot) if t.image_url_snapshot else None,
            )
            for t in ordered
        ],
    )


def _history_fields(row: HistorySessionRow) -> dict[str, Any]:
    return {
        "recommendation_session_id": row.recommendation_session_id,
        "recommended_at": from_db_utc(row.created_at),
        "condition": RecommendationHistoryCondition(
            tpo_cd=row.tpo_cd,
            tpo_text=row.tpo_text,
            season_cd=row.season_cd,
            going_out_start_at=from_db_utc(row.going_out_start_at),
            going_out_end_at=from_db_utc(row.going_out_end_at),
            sido_nm=row.sido_nm,
            sigungu_nm=row.sigungu_nm,
        ),
        "rating": row.rating,
    }


def _to_detail_weather(row: HistoryDetailRow) -> RecommendationHistoryWeather | None:
    weather = to_session_weather(row)
    if weather is None:
        return None
    return RecommendationHistoryWeather(
        **weather.model_dump(),
        precipitation=float(row.precipitation),
        wind_speed=float(row.wind_speed),
    )
