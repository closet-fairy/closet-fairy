"""인증 세션 저장 (E-13). 토큰 원문은 저장하지 않는다."""

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

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
