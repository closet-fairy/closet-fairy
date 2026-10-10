from app.core.errors import ConflictError, NotFoundError


class SessionNotFoundError(NotFoundError):
    code = "SESSION_NOT_FOUND"
    message = "추천 세션을 찾을 수 없습니다."


class SessionAlreadySettledError(ConflictError):
    code = "SESSION_ALREADY_SETTLED"
    message = "이미 별점을 매긴 세션입니다."
