from app.core.errors import ConflictError, NotFoundError


class SessionNotFoundError(NotFoundError):
    code = "SESSION_NOT_FOUND"
    message = "추천 세션을 찾을 수 없습니다."


class SessionAlreadySettledError(ConflictError):
    code = "SESSION_ALREADY_SETTLED"
    message = "이미 별점을 매긴 세션입니다."


class SessionEndedError(ConflictError):
    code = "SESSION_ENDED"
    message = "이미 끝난 추천입니다. 새로 추천을 받아 주세요."


class SessionNotReadyError(ConflictError):
    code = "SESSION_NOT_READY"
    message = "추천이 끝난 뒤에 다시 요청해 주세요."


class OutfitNotInSessionError(NotFoundError):
    code = "OUTFIT_NOT_FOUND"
    message = "이 세션에서 추천한 코디가 아닙니다."
