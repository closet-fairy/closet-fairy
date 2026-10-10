"""이미지 저장소 (#71). DB에는 저장소 키만 두고, URL은 응답할 때 저장소가 만든다."""

from functools import lru_cache
from typing import Protocol

from app.core.config import get_settings
from app.services.storage.local import LocalImageStorage


class ImageStorage(Protocol):
    async def save(self, key: str, data: bytes) -> None: ...

    async def delete(self, key: str) -> None: ...

    def url(self, key: str) -> str: ...


@lru_cache
def get_image_storage() -> ImageStorage:
    settings = get_settings()
    return LocalImageStorage(settings.MEDIA_ROOT, settings.MEDIA_URL_PREFIX)


__all__ = ["ImageStorage", "LocalImageStorage", "get_image_storage"]
