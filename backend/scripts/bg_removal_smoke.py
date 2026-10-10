"""배경 제거 모델 스모크 테스트. 실제 모델로 이미지를 처리하고 시간을 잰다.

backend/ 폴더에서 실행한다:
    python scripts/bg_removal_smoke.py <이미지 또는 폴더> [<이미지 또는 폴더> ...]
결과 PNG는 smoke-output/에 저장된다. 최초 실행 시 모델(약 170MB)을 내려받는다.
"""

from __future__ import annotations

import io
import statistics
import sys
import time
from pathlib import Path

from PIL import Image, ImageOps

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import get_settings  # noqa: E402
from app.services.bg_removal import BackgroundRemover  # noqa: E402

IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp"}
OUTPUT_DIR = Path("smoke-output")


def collect_images(args: list[str]) -> list[Path]:
    paths: list[Path] = []
    for arg in args:
        path = Path(arg)
        if path.is_dir():
            paths.extend(sorted(p for p in path.iterdir() if p.suffix.lower() in IMAGE_SUFFIXES))
        else:
            paths.append(path)
    return paths


def main() -> None:
    images = collect_images(sys.argv[1:])
    if not images:
        print(__doc__)
        sys.exit(1)

    settings = get_settings()
    started = time.perf_counter()
    remover = BackgroundRemover(settings.BG_REMOVAL_MODEL, settings.BG_REMOVAL_POST_PROCESS_MASK)
    remover.warmup()
    print(
        f"모델 {settings.BG_REMOVAL_MODEL}"
        f" (post_process_mask={settings.BG_REMOVAL_POST_PROCESS_MASK})"
        f" 로드 + 워밍업: {(time.perf_counter() - started) * 1000:.0f}ms"
    )

    OUTPUT_DIR.mkdir(exist_ok=True)
    elapsed: list[float] = []
    for path in images:
        data = path.read_bytes()
        with Image.open(io.BytesIO(data)) as src:
            expected_size = ImageOps.exif_transpose(src).size

        t0 = time.perf_counter()
        cutout = remover.remove(data)
        ms = (time.perf_counter() - t0) * 1000
        elapsed.append(ms)

        with Image.open(io.BytesIO(cutout)) as out:
            alpha = out.getchannel("A")
            low, high = alpha.getextrema()
            transparent = sum(alpha.histogram()[:10]) / (out.width * out.height)
            ok = out.mode == "RGBA" and out.size == expected_size
            print(
                f"{path.name}: {len(data) // 1024}KB {expected_size[0]}x{expected_size[1]}"
                f" → {ms:.0f}ms, {out.mode} {out.width}x{out.height},"
                f" 알파 {low}~{high}, 투명 {transparent:.0%} {'OK' if ok else 'MISMATCH'}"
            )
        (OUTPUT_DIR / f"{path.parent.name}-{path.stem}.png").write_bytes(cutout)

    print(
        f"\n{len(elapsed)}장 평균 {statistics.mean(elapsed):.0f}ms"
        f" (min {min(elapsed):.0f} / max {max(elapsed):.0f})"
    )


if __name__ == "__main__":
    main()
