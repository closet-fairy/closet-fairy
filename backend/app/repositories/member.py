"""회원 조회와 가입 (FR-LOGIN-04, E-3)."""

from dataclasses import dataclass

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


@dataclass(frozen=True)
class MemberLogin:
    member_id: int
    is_onboarded: bool


FIND_MEMBER_BY_PROVIDER_SQL = text(
    """
    SELECT m.member_id, s.onboarded_at IS NOT NULL AS is_onboarded
    FROM member m
    LEFT JOIN member_setting s ON s.member_id = m.member_id
    WHERE m.provider_cd = :provider_cd
      AND m.provider_user_id_hash = UNHEX(:provider_user_id_hash)
    """
)

INSERT_MEMBER_SQL = text(
    """
    INSERT INTO member (provider_cd, provider_user_id_enc, provider_user_id_hash, nickname)
    VALUES (:provider_cd, UNHEX(:provider_user_id_enc), UNHEX(:provider_user_id_hash), :nickname)
    """
)

INSERT_MEMBER_SETTING_SQL = text(
    """
    INSERT INTO member_setting (member_id) VALUES (:member_id)
    """
)

INSERT_INITIAL_PREFERENCE_SCORES_SQL = text(
    """
    INSERT INTO preference_score (member_id, attribute_type_cd, attribute_value)
    SELECT :member_id, 'style', style_cd FROM style
    UNION ALL
    SELECT :member_id, 'color', color_cd FROM color
    """
)


async def find_member_by_provider(
    db: AsyncSession, provider_cd: str, provider_user_id_hash: bytes
) -> MemberLogin | None:
    result = await db.execute(
        FIND_MEMBER_BY_PROVIDER_SQL,
        {"provider_cd": provider_cd, "provider_user_id_hash": provider_user_id_hash.hex()},
    )
    row = result.first()
    if row is None:
        return None
    return MemberLogin(member_id=row.member_id, is_onboarded=bool(row.is_onboarded))


async def insert_member(
    db: AsyncSession,
    provider_cd: str,
    provider_user_id_enc: bytes,
    provider_user_id_hash: bytes,
    nickname: str,
) -> int:
    result = await db.execute(
        INSERT_MEMBER_SQL,
        {
            "provider_cd": provider_cd,
            "provider_user_id_enc": provider_user_id_enc.hex(),
            "provider_user_id_hash": provider_user_id_hash.hex(),
            "nickname": nickname,
        },
    )
    member_id = int(result.lastrowid)
    await db.execute(INSERT_MEMBER_SETTING_SQL, {"member_id": member_id})
    await db.execute(INSERT_INITIAL_PREFERENCE_SCORES_SQL, {"member_id": member_id})
    return member_id
