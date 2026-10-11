"""자동 태깅 스모크 테스트. 실제 모델(AUTO_TAGGING_MODEL)로 옷 속성을 받아 본다.

backend/ 폴더에서 실행한다. .env의 ANTHROPIC_API_KEY를 쓴다:
    python scripts/auto_tagging_smoke.py <이미지 또는 폴더> [<이미지 또는 폴더> ...]
투명 배경 이미지(bg_removal_smoke.py의 smoke-output/ 결과 등)는 그대로 태깅하고,
일반 사진은 배경 제거 모델로 누끼를 먼저 만든다.
"""

from __future__ import annotations

import asyncio
import io
import statistics
import sys
import time
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import get_settings  # noqa: E402
from app.services.clothing_tagging import ClothingTagger  # noqa: E402
from app.services.llm import create_llm_client  # noqa: E402

IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp"}


def collect_images(args: list[str]) -> list[Path]:
    paths: list[Path] = []
    for arg in args:
        path = Path(arg)
        if path.is_dir():
            paths.extend(sorted(p for p in path.iterdir() if p.suffix.lower() in IMAGE_SUFFIXES))
        else:
            paths.append(path)
    return paths


def has_alpha(data: bytes) -> bool:
    with Image.open(io.BytesIO(data)) as image:
        return image.mode in ("RGBA", "LA", "PA")


async def main() -> None:
    images = collect_images(sys.argv[1:])
    if not images:
        print(__doc__)
        sys.exit(1)

    settings = get_settings()
    llm = create_llm_client(settings)
    tagger = ClothingTagger(llm, settings.AUTO_TAGGING_MODEL, settings.AUTO_TAGGING_IMAGE_MAX_SIDE)
    remover = None
    elapsed: list[float] = []
    try:
        for path in images:
            data = path.read_bytes()
            if not has_alpha(data):
                if remover is None:
                    from app.services.bg_removal import BackgroundRemover

                    remover = BackgroundRemover(
                        settings.BG_REMOVAL_MODEL,
                        settings.BG_REMOVAL_POST_PROCESS_MASK,
                        settings.BG_REMOVAL_MAX_SIDE,
                        settings.CLOTHING_IMAGE_WEBP_QUALITY,
                    )
                data = remover.remove(data)

            t0 = time.perf_counter()
            try:
                tags = await tagger.tag(data)
            except Exception as e:
                print(f"{path.name}: 실패 {type(e).__name__} {e}")
                continue
            ms = (time.perf_counter() - t0) * 1000
            elapsed.append(ms)
            print(
                f"{path.name} ({ms:.0f}ms): {tags.category_cd}"
                f"{'/' + tags.accessory_type_cd if tags.accessory_type_cd else ''}"
                f" | {tags.item_name} | {tags.color_cd}({tags.color_text})"
                f" | 스타일 {','.join(tags.style_cds) or '-'}"
                f" | 계절 {','.join(tags.season_cds) or '-'}"
                f" | 두께 {tags.thickness_cd} | 방수 {tags.is_waterproof}"
            )
    finally:
        await llm.aclose()

    if not elapsed:
        return
    print(
        f"\n모델 {settings.AUTO_TAGGING_MODEL}, {len(elapsed)}장"
        f" 평균 {statistics.mean(elapsed):.0f}ms"
        f" (min {min(elapsed):.0f} / max {max(elapsed):.0f})"
    )


if __name__ == "__main__":
    asyncio.run(main())
