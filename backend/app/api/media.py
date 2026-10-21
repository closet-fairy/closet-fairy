import asyncio
import stat

from fastapi import APIRouter, Depends, Request
from fastapi.responses import FileResponse, Response
from starlette.staticfiles import NotModifiedResponse

from app.api.deps import get_current_member_id
from app.core.config import get_settings
from app.core.errors import NotFoundError
from app.services import media_access
from app.services.storage import LocalImageStorage, get_image_storage

router = APIRouter(prefix=get_settings().MEDIA_URL_PREFIX, include_in_schema=False)

CACHE_CONTROL = "private, max-age=3600"


@router.get("/{key:path}")
async def get_media(
    key: str,
    request: Request,
    member_id: int = Depends(get_current_member_id),
    storage: LocalImageStorage = Depends(get_image_storage),
) -> Response:
    try:
        path = storage.path(key)
    except ValueError as e:
        raise NotFoundError() from e
    if not media_access.can_view(member_id, path.relative_to(storage.root).as_posix()):
        raise NotFoundError()
    try:
        stat_result = await asyncio.to_thread(path.stat)
    except OSError as e:
        raise NotFoundError() from e
    if not stat.S_ISREG(stat_result.st_mode):
        raise NotFoundError()

    response = FileResponse(path, stat_result=stat_result, headers={"Cache-Control": CACHE_CONTROL})
    if _matches_etag(request, response.headers["etag"]):
        return NotModifiedResponse(response.headers)
    return response


def _matches_etag(request: Request, etag: str) -> bool:
    if_none_match = request.headers.get("if-none-match")
    if not if_none_match:
        return False
    return etag in [tag.strip(" W/") for tag in if_none_match.split(",")]
