"""비동기 DB 연결.

연결마다 timezone을 '+00:00'으로 맞춘다. docker-compose.yml에
--default-time-zone=+00:00을 이미 걸어뒀지만, 클라이언트 세션
기준으로도 한 번 더 강제해 이중으로 안전하게 만든다.
"""
from collections.abc import AsyncGenerator

from sqlalchemy import event, text
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import get_settings

settings = get_settings()

engine: AsyncEngine = create_async_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,  # 끊긴 연결을 재사용하지 않도록
    echo=False,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI Depends(get_db)로 라우터에 주입해서 쓴다."""
    async with AsyncSessionLocal() as session:
        yield session


async def check_connection() -> bool:
    """헬스체크용. 연결만 확인하고 세션은 즉시 반환한다."""
    async with engine.connect() as conn:
        await conn.execute(text("SELECT 1"))
    return True
