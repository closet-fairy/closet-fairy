"""개인 설정 조회 (REC-07). 온보딩 전이면 행이 없을 수 있다."""

from collections.abc import Sequence
from dataclasses import dataclass

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


@dataclass(frozen=True)
class MemberSettingRow:
    member_setting_id: int
    birth_year: int | None
    temperature_sensitivity_cd: str | None
    gender_cd: str


@dataclass(frozen=True)
class MemberSettingDetail:
    member_setting_id: int
    birth_year: int | None
    temperature_sensitivity_cd: str | None
    gender_cd: str
    is_onboarded: bool


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


SELECT_SETTING_DETAIL_SQL = text(
    """
    SELECT member_setting_id, birth_year, temperature_sensitivity_cd, gender_cd,
           onboarded_at IS NOT NULL AS is_onboarded
    FROM member_setting
    WHERE member_id = :member_id
    """
)

UPDATE_SETTING_SQL = text(
    """
    UPDATE member_setting
    SET birth_year = :birth_year,
        temperature_sensitivity_cd = :temperature_sensitivity_cd,
        gender_cd = :gender_cd,
        onboarded_at = COALESCE(onboarded_at, UTC_TIMESTAMP())
    WHERE member_setting_id = :member_setting_id
    """
)

DELETE_STYLES_SQL = text(
    """
    DELETE FROM member_setting_style WHERE member_setting_id = :member_setting_id
    """
)

INSERT_STYLE_SQL = text(
    """
    INSERT INTO member_setting_style (member_setting_id, style_cd)
    VALUES (:member_setting_id, :style_cd)
    """
)

CLAIM_STYLE_BONUS_SQL = text(
    """
    UPDATE member_setting
    SET initial_style_bonus_at = UTC_TIMESTAMP()
    WHERE member_setting_id = :member_setting_id AND initial_style_bonus_at IS NULL
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


async def find_setting_detail(db: AsyncSession, member_id: int) -> MemberSettingDetail | None:
    result = await db.execute(SELECT_SETTING_DETAIL_SQL, {"member_id": member_id})
    row = result.first()
    if row is None:
        return None
    return MemberSettingDetail(
        member_setting_id=row.member_setting_id,
        birth_year=row.birth_year,
        temperature_sensitivity_cd=row.temperature_sensitivity_cd,
        gender_cd=row.gender_cd,
        is_onboarded=bool(row.is_onboarded),
    )


async def update_setting(
    db: AsyncSession,
    member_setting_id: int,
    birth_year: int,
    temperature_sensitivity_cd: str | None,
    gender_cd: str,
) -> None:
    await db.execute(
        UPDATE_SETTING_SQL,
        {
            "member_setting_id": member_setting_id,
            "birth_year": birth_year,
            "temperature_sensitivity_cd": temperature_sensitivity_cd,
            "gender_cd": gender_cd,
        },
    )


async def replace_styles(
    db: AsyncSession, member_setting_id: int, style_cds: Sequence[str]
) -> None:
    await db.execute(DELETE_STYLES_SQL, {"member_setting_id": member_setting_id})
    if style_cds:
        await db.execute(
            INSERT_STYLE_SQL,
            [{"member_setting_id": member_setting_id, "style_cd": cd} for cd in style_cds],
        )


async def claim_style_bonus(db: AsyncSession, member_setting_id: int) -> bool:
    result = await db.execute(CLAIM_STYLE_BONUS_SQL, {"member_setting_id": member_setting_id})
    return result.rowcount == 1
