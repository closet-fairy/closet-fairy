"""공통 에러 처리.

서비스 코드는 여기 정의된 예외를 raise하기만 하면,
전역 핸들러가 {code, message} 형태로 응답을 통일해서 반환한다.
"""
from __future__ import annotations

from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse


class AppError(Exception):
    """도메인 에러의 공통 부모. 직접 사용하지 않고 하위 클래스를 정의해 쓴다."""

    code: str = "INTERNAL_ERROR"
    status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR
    message: str = "처리 중 오류가 발생했습니다."

    def __init__(self, message: str | None = None) -> None:
        if message:
            self.message = message
        super().__init__(self.message)


class NotFoundError(AppError):
    code = "NOT_FOUND"
    status_code = status.HTTP_404_NOT_FOUND
    message = "요청한 리소스를 찾을 수 없습니다."


class ValidationError(AppError):
    code = "VALIDATION_ERROR"
    status_code = 422
    message = "입력값이 올바르지 않습니다."


class UnauthorizedError(AppError):
    code = "UNAUTHORIZED"
    status_code = status.HTTP_401_UNAUTHORIZED
    message = "인증이 필요합니다."


class ForbiddenError(AppError):
    code = "FORBIDDEN"
    status_code = status.HTTP_403_FORBIDDEN
    message = "권한이 없습니다."


class ConflictError(AppError):
    code = "CONFLICT"
    status_code = status.HTTP_409_CONFLICT
    message = "요청을 처리할 수 없는 상태입니다."


def register_exception_handlers(app: FastAPI) -> None:
    """main.py에서 앱 생성 직후 한 번 호출한다."""

    @app.exception_handler(AppError)
    async def handle_app_error(request: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={"code": exc.code, "message": exc.message},
        )

    @app.exception_handler(Exception)
    async def handle_unexpected_error(request: Request, exc: Exception) -> JSONResponse:
        # 예상 못한 예외는 500으로 감추고, 상세는 로그로만 남긴다 (다음 단계에서 logging 연결)
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"code": "INTERNAL_ERROR", "message": "처리 중 오류가 발생했습니다."},
        )
