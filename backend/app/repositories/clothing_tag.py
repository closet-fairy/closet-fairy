"""옷의 스타일·계절 태그. 자동 태깅(#73)과 회원 수정(#75)이 목록을 통째로 바꾼다."""

from collections.abc import Sequence

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

DELETE_STYLES_SQL = text("DELETE FROM clothing_style WHERE clothing_id = :clothing_id")
DELETE_SEASONS_SQL = text("DELETE FROM clothing_season WHERE clothing_id = :clothing_id")
INSERT_STYLE_SQL = text(
    "INSERT INTO clothing_style (clothing_id, style_cd) VALUES (:clothing_id, :style_cd)"
)
INSERT_SEASON_SQL = text(
    "INSERT INTO clothing_season (clothing_id, season_cd) VALUES (:clothing_id, :season_cd)"
)


async def replace_styles(db: AsyncSession, clothing_id: int, style_cds: Sequence[str]) -> None:
    await db.execute(DELETE_STYLES_SQL, {"clothing_id": clothing_id})
    for style_cd in style_cds:
        await db.execute(INSERT_STYLE_SQL, {"clothing_id": clothing_id, "style_cd": style_cd})


async def replace_seasons(db: AsyncSession, clothing_id: int, season_cds: Sequence[str]) -> None:
    await db.execute(DELETE_SEASONS_SQL, {"clothing_id": clothing_id})
    for season_cd in season_cds:
        await db.execute(INSERT_SEASON_SQL, {"clothing_id": clothing_id, "season_cd": season_cd})
