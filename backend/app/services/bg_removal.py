"""배경 제거 모델 (#77).

rembg로 IS-Net(isnet-general-use)을 onnxruntime에서 돌린다.
세션 생성(모델 로드, 최초 1회는 다운로드)과 추론은 모두 CPU를 붙잡는 동기 작업이라
이벤트 루프에서 직접 부르지 말고 스레드에서 실행한다.
결과는 긴 변을 max_side 이하로 줄인 뒤 투명도를 가진 WEBP로 저장한다.
"""

import io
import logging
import time

from PIL import Image, ImageOps

logger = logging.getLogger(__name__)


class BackgroundRemover:
    def __init__(
        self, model_name: str, post_process_mask: bool, max_side: int, webp_quality: int
    ) -> None:
        # rembg는 import에만 수십 초가 걸려,
        # 배경 제거를 꺼 둔 테스트·재기동에서는 불러오지 않도록 여기서 가져온다
        from rembg import new_session, remove

        self.model_name = model_name
        self._post_process_mask = post_process_mask
        self._max_side = max_side
        self._webp_quality = webp_quality
        self._remove = remove
        self._session = new_session(model_name)

    def warmup(self) -> None:
        # onnxruntime은 첫 추론에서 내부 초기화를 하므로,
        # 첫 사용자 요청이 그 비용을 떠안지 않게 미리 한 번 돌린다
        buf = io.BytesIO()
        Image.new("RGB", (64, 64), (200, 200, 200)).save(buf, "PNG")
        started = time.perf_counter()
        self.remove(buf.getvalue())
        logger.info(
            "배경 제거 모델 워밍업 완료",
            extra={
                "model": self.model_name,
                "elapsed_ms": round((time.perf_counter() - started) * 1000),
            },
        )

    def remove(self, image: bytes) -> bytes:
        """EXIF 회전을 적용하고 긴 변이 max_side 이하인 RGBA WEBP를 돌려준다."""
        with Image.open(io.BytesIO(image)) as source:
            source.load()
            ImageOps.exif_transpose(source, in_place=True)
            source.thumbnail((self._max_side, self._max_side), Image.Resampling.LANCZOS)
            cutout = self._remove(
                source, session=self._session, post_process_mask=self._post_process_mask
            )
        out = io.BytesIO()
        cutout.save(out, format="WEBP", quality=self._webp_quality)
        return out.getvalue()
