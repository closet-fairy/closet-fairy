import logging
import secrets
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, Request, status
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.db import get_db
from app.services.auth import login as login_service
from app.services.auth.crypto import new_oauth_state
from app.services.auth.providers import OAuthProvider, OAuthProviderError, get_oauth_provider

router = APIRouter(prefix="/auth", tags=["auth"])
logger = logging.getLogger(__name__)

SESSION_COOKIE = "closet_fairy_session"
OAUTH_STATE_COOKIE = "closet_fairy_oauth_state"
OAUTH_STATE_MAX_AGE_S = 10 * 60
SECONDS_PER_DAY = 24 * 60 * 60

LOGIN_CANCELLED = "cancelled"
LOGIN_INVALID_STATE = "invalid_state"
LOGIN_FAILED = "failed"


@router.get(
    "/{provider_cd}/login",
    status_code=status.HTTP_302_FOUND,
    response_class=RedirectResponse,
    responses={404: {"description": "지원하지 않는 제공자"}, 503: {"description": "키 미설정"}},
)
async def start_login(
    provider_cd: str,
    provider: OAuthProvider = Depends(get_oauth_provider),
) -> RedirectResponse:
    state = new_oauth_state()
    response = RedirectResponse(
        provider.authorize_url(state, _redirect_uri(provider_cd)),
        status_code=status.HTTP_302_FOUND,
    )
    _set_cookie(response, OAUTH_STATE_COOKIE, state, OAUTH_STATE_MAX_AGE_S)
    return response


@router.get(
    "/{provider_cd}/callback",
    status_code=status.HTTP_302_FOUND,
    response_class=RedirectResponse,
)
async def finish_login(
    provider_cd: str,
    request: Request,
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    provider: OAuthProvider = Depends(get_oauth_provider),
    db: AsyncSession = Depends(get_db),
) -> RedirectResponse:
    if error is not None:
        return _login_failed(LOGIN_CANCELLED if error == "access_denied" else LOGIN_FAILED)
    saved_state = request.cookies.get(OAUTH_STATE_COOKIE)
    if (
        not code
        or not state
        or not saved_state
        or not secrets.compare_digest(state.encode(), saved_state.encode())
    ):
        return _login_failed(LOGIN_INVALID_STATE)

    try:
        result = await login_service.login_with_provider(
            db, provider, code, _redirect_uri(provider_cd)
        )
    except OAuthProviderError as e:
        logger.warning("소셜 로그인 실패", extra={"provider_cd": provider_cd, "reason": str(e)})
        return _login_failed(LOGIN_FAILED)
    except Exception:
        logger.exception("로그인 처리 중 오류", extra={"provider_cd": provider_cd})
        return _login_failed(LOGIN_FAILED)

    response = _redirect_to_frontend("/" if result.is_onboarded else "/onboarding")
    _set_cookie(
        response,
        SESSION_COOKIE,
        result.session_token,
        get_settings().SESSION_TTL_DAYS * SECONDS_PER_DAY,
    )
    response.delete_cookie(OAUTH_STATE_COOKIE, path="/")
    return response


def _redirect_uri(provider_cd: str) -> str:
    base = get_settings().OAUTH_REDIRECT_BASE_URL.rstrip("/")
    return f"{base}/auth/{provider_cd}/callback"


def _redirect_to_frontend(path: str) -> RedirectResponse:
    base = get_settings().FRONTEND_BASE_URL.rstrip("/")
    return RedirectResponse(f"{base}{path}", status_code=status.HTTP_302_FOUND)


def _login_failed(reason: str) -> RedirectResponse:
    response = _redirect_to_frontend(f"/login?{urlencode({'error': reason})}")
    response.delete_cookie(OAUTH_STATE_COOKIE, path="/")
    return response


def _set_cookie(response: RedirectResponse, name: str, value: str, max_age: int) -> None:
    response.set_cookie(
        name,
        value,
        max_age=max_age,
        path="/",
        httponly=True,
        samesite="lax",
        secure=get_settings().SESSION_COOKIE_SECURE,
    )
