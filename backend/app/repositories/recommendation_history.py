"""추천 내역 목록 조회 (#173)."""

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import bindparam, text
from sqlalchemy.ext.asyncio import AsyncSession


@dataclass(frozen=True)
class HistorySessionRow:
    recommendation_session_id: int
    created_at: datetime
    tpo_cd: str
    tpo_text: str | None
    season_cd: str
    sido_nm: str
    sigungu_nm: str
    going_out_start_at: datetime
    going_out_end_at: datetime
    rated_outfit_id: int
    rating: int
    temperature: Decimal | None
    feels_like_temperature: Decimal | None
    weather_condition_cd: str | None
    is_weather_fallback: bool | None
    has_weather: bool


@dataclass(frozen=True)
class HistoryThumbnailRow:
    outfit_id: int
    outfit_item_id: int
    slot_cd: str
    item_name_snapshot: str
    image_url_snapshot: str | None


HISTORY_PAGE_SQL = text(
    """
    SELECT s.recommendation_session_id, s.created_at,
           s.tpo_cd, s.tpo_text, s.season_cd, s.sido_nm, s.sigungu_nm,
           s.going_out_start_at, s.going_out_end_at,
           f.outfit_id AS rated_outfit_id, f.rating,
           w.temperature, w.feels_like_temperature, w.weather_condition_cd,
           w.is_fallback AS is_weather_fallback,
           w.recommendation_session_id AS weather_session_id
    FROM recommendation_session s
    JOIN outfit_feedback f
      ON f.recommendation_session_id = s.recommendation_session_id
     AND f.feedback_type_cd = 'rated'
    LEFT JOIN weather_snapshot w ON w.recommendation_session_id = s.recommendation_session_id
    WHERE s.member_id = :member_id
      AND s.session_status_cd = 'completed'
      AND (:cursor IS NULL OR s.recommendation_session_id < :cursor)
    -- created_at은 초 단위라 같은 시각이면 커서가 흔들려 id로 정렬한다.
    -- id 순서와 추천 시각 순서는 같다.
    ORDER BY s.recommendation_session_id DESC
    LIMIT :limit
    """
)

THUMBNAILS_SQL = text(
    """
    SELECT i.outfit_id, i.outfit_item_id, i.slot_cd, i.item_name_snapshot, i.image_url_snapshot
    FROM outfit_item i
    WHERE i.outfit_id IN :outfit_ids
    ORDER BY i.outfit_id, i.outfit_item_id
    """
).bindparams(bindparam("outfit_ids", expanding=True))


async def get_history_page(
    db: AsyncSession, member_id: int, cursor: int | None, limit: int
) -> list[HistorySessionRow]:
    rows = (
        await db.execute(
            HISTORY_PAGE_SQL, {"member_id": member_id, "cursor": cursor, "limit": limit}
        )
    ).all()
    return [HistorySessionRow(**_session_fields(row)) for row in rows]


def _session_fields(row) -> dict[str, Any]:
    return {
        "recommendation_session_id": row.recommendation_session_id,
        "created_at": row.created_at,
        "tpo_cd": row.tpo_cd,
        "tpo_text": row.tpo_text,
        "season_cd": row.season_cd,
        "sido_nm": row.sido_nm,
        "sigungu_nm": row.sigungu_nm,
        "going_out_start_at": row.going_out_start_at,
        "going_out_end_at": row.going_out_end_at,
        "rated_outfit_id": row.rated_outfit_id,
        "rating": row.rating,
        "temperature": row.temperature,
        "feels_like_temperature": row.feels_like_temperature,
        "weather_condition_cd": row.weather_condition_cd,
        "is_weather_fallback": (
            bool(row.is_weather_fallback) if row.is_weather_fallback is not None else None
        ),
        "has_weather": row.weather_session_id is not None,
    }


async def get_thumbnails(db: AsyncSession, outfit_ids: Sequence[int]) -> list[HistoryThumbnailRow]:
    if not outfit_ids:
        return []
    rows = (await db.execute(THUMBNAILS_SQL, {"outfit_ids": list(outfit_ids)})).all()
    return [
        HistoryThumbnailRow(
            outfit_id=row.outfit_id,
            outfit_item_id=row.outfit_item_id,
            slot_cd=row.slot_cd,
            item_name_snapshot=row.item_name_snapshot,
            image_url_snapshot=row.image_url_snapshot,
        )
        for row in rows
    ]
