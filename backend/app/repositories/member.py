"""회원 조회와 가입 (FR-LOGIN-04, E-3)."""

from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


@dataclass(frozen=True)
class MemberLogin:
    member_id: int
    is_onboarded: bool


@dataclass(frozen=True)
class MemberProfile:
    nickname: str
    provider_cd: str
    created_at: datetime
    is_onboarded: bool


@dataclass(frozen=True)
class MemberAccount:
    provider_cd: str
    provider_user_id_hash: bytes


FIND_MEMBER_BY_PROVIDER_SQL = text(
    """
    SELECT m.member_id, s.onboarded_at IS NOT NULL AS is_onboarded
    FROM member m
    LEFT JOIN member_setting s ON s.member_id = m.member_id
    WHERE m.provider_cd = :provider_cd
      AND m.provider_user_id_hash = UNHEX(:provider_user_id_hash)
    """
)

FIND_MEMBER_PROFILE_SQL = text(
    """
    SELECT m.nickname, m.provider_cd, m.created_at, s.onboarded_at IS NOT NULL AS is_onboarded
    FROM member m
    LEFT JOIN member_setting s ON s.member_id = m.member_id
    WHERE m.member_id = :member_id
    """
)

FIND_MEMBER_ACCOUNT_SQL = text(
    """
    SELECT provider_cd, provider_user_id_hash FROM member WHERE member_id = :member_id
    """
)

DELETE_MEMBER_SQL = text(
    """
    DELETE FROM member WHERE member_id = :member_id
    """
)

UPDATE_NICKNAME_SQL = text(
    """
    UPDATE member SET nickname = :nickname WHERE member_id = :member_id
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


async def find_member_profile(db: AsyncSession, member_id: int) -> MemberProfile | None:
    result = await db.execute(FIND_MEMBER_PROFILE_SQL, {"member_id": member_id})
    row = result.first()
    if row is None:
        return None
    return MemberProfile(
        nickname=row.nickname,
        provider_cd=row.provider_cd,
        created_at=row.created_at,
        is_onboarded=bool(row.is_onboarded),
    )


async def update_nickname(db: AsyncSession, member_id: int, nickname: str) -> None:
    await db.execute(UPDATE_NICKNAME_SQL, {"member_id": member_id, "nickname": nickname})


async def find_member_account(db: AsyncSession, member_id: int) -> MemberAccount | None:
    result = await db.execute(FIND_MEMBER_ACCOUNT_SQL, {"member_id": member_id})
    row = result.first()
    if row is None:
        return None
    return MemberAccount(
        provider_cd=row.provider_cd, provider_user_id_hash=bytes(row.provider_user_id_hash)
    )


async def delete_member(db: AsyncSession, member_id: int) -> None:
    await db.execute(DELETE_MEMBER_SQL, {"member_id": member_id})
