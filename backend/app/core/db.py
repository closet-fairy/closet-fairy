"""비동기 DB 연결.

timezone은 docker-compose.yml의 --default-time-zone=+00:00 설정에
의존한다. 이 설정이 없는 MySQL(예: 관리형 DB)에 붙이면 서버 기본
timezone을 따르므로, 그런 환경에서는 별도로 맞춰줘야 한다.
"""

from collections.abc import AsyncGenerator

from sqlalchemy import text
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
