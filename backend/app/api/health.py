from fastapi import APIRouter

from app.core.db import check_connection
from app.core.errors import AppError

router = APIRouter(tags=["health"])


@router.get("/health")
async def health() -> dict[str, str]:
    """서버 + DB 연결까지 확인한다."""
    try:
        await check_connection()
    except Exception as exc:  # noqa: BLE001 - 헬스체크는 원인 불문하고 down 처리
        raise AppError("DB 연결에 실패했습니다.") from exc
    return {"status": "ok"}
