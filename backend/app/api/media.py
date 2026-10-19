from fastapi import APIRouter, Depends
from fastapi.responses import FileResponse

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
    member_id: int = Depends(get_current_member_id),
    storage: LocalImageStorage = Depends(get_image_storage),
) -> FileResponse:
    if not media_access.can_view(member_id, key):
        raise NotFoundError()
    try:
        path = storage.path(key)
    except ValueError as e:
        raise NotFoundError() from e
    if not path.is_file():
        raise NotFoundError()
    return FileResponse(path, headers={"Cache-Control": CACHE_CONTROL})
