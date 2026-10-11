"""누끼 이미지로 옷 속성을 자동 태깅한다 (#73, FR-REG-11·17·18)."""

import asyncio
import base64
import io

from PIL import Image

from app.repositories.clothing_job import ClothingTags
from app.services.llm import LLMCallConfig, LLMClient
from app.services.prompt.clothing_tagging import (
    ClothingTaggingOutput,
    assemble_clothing_tagging_prompt,
)

CALL_NAME = "clothing_tagging"
REQUEST_TIMEOUT_S = 20.0
# 투명 배경은 모델이 검정으로 볼 수 있어 검은 옷이 묻히고, 흰 바탕은 흰 옷이 묻혀 연회색을 쓴다
BACKGROUND_RGB = (238, 238, 238)
JPEG_QUALITY = 90
ITEM_NAME_MAX_LENGTH = 100
COLOR_TEXT_MAX_LENGTH = 30


class ClothingTagger:
    def __init__(self, llm: LLMClient, model: str, image_max_side: int) -> None:
        self._llm = llm
        self._model = model
        self._image_max_side = image_max_side

    async def tag(self, cutout: bytes) -> ClothingTags:
        image = await asyncio.to_thread(prepare_tagging_image, cutout, self._image_max_side)
        prompt = assemble_clothing_tagging_prompt()
        output = await self._llm.call_structured(
            LLMCallConfig(
                call_name=CALL_NAME,
                prompt_version=prompt.prompt_version,
                model=self._model,
                max_tokens=1024,
                temperature=0.0,
                timeout_s=REQUEST_TIMEOUT_S,
            ),
            system=prompt.system,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": "image/jpeg",
                                "data": base64.b64encode(image).decode("ascii"),
                            },
                        },
                        {"type": "text", "text": prompt.user},
                    ],
                }
            ],
            output_model=ClothingTaggingOutput,
        )
        return to_clothing_tags(output)


def prepare_tagging_image(cutout: bytes, max_side: int) -> bytes:
    """투명 배경을 연회색으로 채우고 긴 변을 max_side 이하로 줄인 JPEG를 만든다."""
    with Image.open(io.BytesIO(cutout)) as source:
        rgba = source.convert("RGBA")
    rgba.thumbnail((max_side, max_side), Image.Resampling.LANCZOS)
    canvas = Image.new("RGB", rgba.size, BACKGROUND_RGB)
    canvas.paste(rgba, mask=rgba.getchannel("A"))
    out = io.BytesIO()
    canvas.save(out, format="JPEG", quality=JPEG_QUALITY)
    return out.getvalue()


def to_clothing_tags(output: ClothingTaggingOutput) -> ClothingTags:
    return ClothingTags(
        category_cd=output.category,
        accessory_type_cd=output.accessory_type if output.category == "accessories" else None,
        item_name=_clean_text(output.item_name, ITEM_NAME_MAX_LENGTH),
        color_cd=output.color,
        color_text=_clean_text(output.color_text, COLOR_TEXT_MAX_LENGTH),
        style_cds=tuple(dict.fromkeys(output.styles)),
        season_cds=tuple(dict.fromkeys(output.seasons)),
        thickness_cd=output.thickness,
        is_waterproof=output.is_waterproof,
    )


def _clean_text(value: str | None, max_length: int) -> str | None:
    if value is None:
        return None
    value = " ".join(value.split())[:max_length].rstrip()
    return value or None
