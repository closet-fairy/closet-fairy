"""로컬 폴더 이미지 저장소. main.py가 같은 폴더를 MEDIA_URL_PREFIX 경로로 내보낸다."""

import asyncio
from pathlib import Path


class LocalImageStorage:
    def __init__(self, root: Path, url_prefix: str) -> None:
        self.root = root.resolve()
        self.url_prefix = url_prefix.rstrip("/")

    async def save(self, key: str, data: bytes) -> None:
        await asyncio.to_thread(self._write, self._path(key), data)

    async def read(self, key: str) -> bytes:
        return await asyncio.to_thread(self._path(key).read_bytes)

    async def delete(self, key: str) -> None:
        await asyncio.to_thread(self._path(key).unlink, missing_ok=True)

    def url(self, key: str) -> str:
        return f"{self.url_prefix}/{key}"

    def _path(self, key: str) -> Path:
        path = (self.root / key).resolve()
        if not path.is_relative_to(self.root) or path == self.root:
            raise ValueError(f"저장소 밖을 가리키는 키입니다: {key}")
        return path

    @staticmethod
    def _write(path: Path, data: bytes) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
