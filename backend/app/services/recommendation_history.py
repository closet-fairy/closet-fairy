"""추천 내역 목록 조회 (#173)."""

from collections.abc import Sequence

from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories import recommendation_history as history_repo
from app.repositories.recommendation_history import HistorySessionRow, HistoryThumbnailRow
from app.schemas.recommendation_history import (
    RecommendationHistoryCondition,
    RecommendationHistoryItem,
    RecommendationHistoryPage,
    RecommendationHistoryThumbnail,
)
from app.schemas.recommendation_result import SessionWeather
from app.services.prompt.outfit_generation import CATEGORY_ORDER
from app.services.recommendation_session import from_db_utc
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


def _to_item(
    row: HistorySessionRow, thumbnails: Sequence[HistoryThumbnailRow], storage: ImageStorage
) -> RecommendationHistoryItem:
    ordered = sorted(thumbnails, key=lambda t: (CATEGORY_ORDER.index(t.slot_cd), t.outfit_item_id))
    return RecommendationHistoryItem(
        recommendation_session_id=row.recommendation_session_id,
        recommended_at=from_db_utc(row.created_at),
        condition=RecommendationHistoryCondition(
            tpo_cd=row.tpo_cd,
            tpo_text=row.tpo_text,
            season_cd=row.season_cd,
            going_out_start_at=from_db_utc(row.going_out_start_at),
            going_out_end_at=from_db_utc(row.going_out_end_at),
            sido_nm=row.sido_nm,
            sigungu_nm=row.sigungu_nm,
        ),
        weather=_to_weather(row),
        rating=row.rating,
        thumbnails=[
            RecommendationHistoryThumbnail(
                slot_cd=t.slot_cd,
                item_name=t.item_name_snapshot,
                image_url=storage.url(t.image_url_snapshot) if t.image_url_snapshot else None,
            )
            for t in ordered
        ],
    )


def _to_weather(row: HistorySessionRow) -> SessionWeather | None:
    if not row.has_weather:
        return None
    return SessionWeather(
        temperature=float(row.temperature),
        feels_like_temperature=float(row.feels_like_temperature),
        weather_condition_cd=row.weather_condition_cd,
        is_fallback=bool(row.is_weather_fallback),
    )
