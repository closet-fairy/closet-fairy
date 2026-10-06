"""개인 설정 조회 (REC-07). 온보딩 전이면 행이 없을 수 있다."""

from dataclasses import dataclass

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


@dataclass(frozen=True)
class MemberSettingRow:
    member_setting_id: int
    birth_year: int | None
    temperature_sensitivity_cd: str | None
    gender_cd: str


SELECT_SETTING_SQL = text(
    """
    SELECT member_setting_id, birth_year, temperature_sensitivity_cd, gender_cd
    FROM member_setting
    WHERE member_id = :member_id
    """
)

SELECT_STYLES_SQL = text(
    """
    SELECT style_cd
    FROM member_setting_style
    WHERE member_setting_id = :member_setting_id
    """
)


async def get_member_setting(db: AsyncSession, member_id: int) -> MemberSettingRow | None:
    result = await db.execute(SELECT_SETTING_SQL, {"member_id": member_id})
    row = result.first()
    if row is None:
        return None
    return MemberSettingRow(
        member_setting_id=row.member_setting_id,
        birth_year=row.birth_year,
        temperature_sensitivity_cd=row.temperature_sensitivity_cd,
        gender_cd=row.gender_cd,
    )


async def get_preferred_styles(db: AsyncSession, member_setting_id: int) -> list[str]:
    result = await db.execute(SELECT_STYLES_SQL, {"member_setting_id": member_setting_id})
    return [row.style_cd for row in result.all()]
