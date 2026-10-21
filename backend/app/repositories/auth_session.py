"""인증 세션 저장 (E-13). 토큰 원문은 저장하지 않는다."""

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

FIND_ACTIVE_SESSION_MEMBER_SQL = text(
    """
    SELECT member_id
    FROM auth_session
    WHERE session_token_hash = UNHEX(:session_token_hash)
      AND revoked_at IS NULL
      AND expires_at > UTC_TIMESTAMP()
    """
)

REVOKE_SESSION_SQL = text(
    """
    UPDATE auth_session
    SET revoked_at = UTC_TIMESTAMP()
    WHERE session_token_hash = UNHEX(:session_token_hash) AND revoked_at IS NULL
    """
)

INSERT_SESSION_SQL = text(
    """
    INSERT INTO auth_session (member_id, session_token_hash, expires_at)
    VALUES (:member_id, UNHEX(:session_token_hash), UTC_TIMESTAMP() + INTERVAL :ttl_days DAY)
    """
)


async def insert_session(
    db: AsyncSession, member_id: int, session_token_hash: bytes, ttl_days: int
) -> None:
    await db.execute(
        INSERT_SESSION_SQL,
        {
            "member_id": member_id,
            "session_token_hash": session_token_hash.hex(),
            "ttl_days": ttl_days,
        },
    )


async def find_active_session_member(db: AsyncSession, session_token_hash: bytes) -> int | None:
    result = await db.execute(
        FIND_ACTIVE_SESSION_MEMBER_SQL, {"session_token_hash": session_token_hash.hex()}
    )
    row = result.first()
    return None if row is None else int(row.member_id)


async def revoke_session(db: AsyncSession, session_token_hash: bytes) -> None:
    await db.execute(REVOKE_SESSION_SQL, {"session_token_hash": session_token_hash.hex()})
