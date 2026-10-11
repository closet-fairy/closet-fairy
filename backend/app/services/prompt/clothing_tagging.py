"""자동 태깅 프롬프트 (#73, FR-REG-17·18)."""

import pydantic

from app.schemas.codes import (
    AccessoryTypeCd,
    CategoryCd,
    ColorCd,
    SeasonCd,
    StyleCd,
    ThicknessCd,
)
from app.services.prompt.outfit_generation import AssembledPrompt
from app.services.prompt.template import load_prompt_template, render

PROMPT_NAME = "clothing_tagging"
PROMPT_VERSION = "v1.0"


class ClothingTaggingOutput(pydantic.BaseModel):
    category: CategoryCd | None
    accessory_type: AccessoryTypeCd | None
    item_name: str | None
    color: ColorCd | None
    color_text: str | None
    styles: list[StyleCd]
    seasons: list[SeasonCd]
    thickness: ThicknessCd | None
    is_waterproof: bool | None


def assemble_clothing_tagging_prompt() -> AssembledPrompt:
    template = load_prompt_template(PROMPT_NAME, PROMPT_VERSION)
    return AssembledPrompt(
        system=render(template.system, {}),
        user=render(template.user, {}),
        prompt_version=template.prompt_version,
    )
