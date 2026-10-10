"""배경 제거 모델 (#77).

rembg로 IS-Net(isnet-general-use)을 onnxruntime에서 돌린다.
세션 생성(모델 로드, 최초 1회는 다운로드)과 추론은 모두 CPU를 붙잡는 동기 작업이라
이벤트 루프에서 직접 부르지 말고 스레드에서 실행한다.
"""

import io
import logging
import time

from PIL import Image
from rembg import new_session, remove

logger = logging.getLogger(__name__)


class BackgroundRemover:
    def __init__(self, model_name: str, post_process_mask: bool) -> None:
        self.model_name = model_name
        self._post_process_mask = post_process_mask
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
        """원본 해상도의 RGBA PNG를 돌려준다. EXIF 회전은 rembg가 먼저 바로잡는다."""
        return remove(
            image,
            session=self._session,
            post_process_mask=self._post_process_mask,
            force_return_bytes=True,
        )
