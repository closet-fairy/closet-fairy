"""재추천 의도 파싱 프롬프트 (#83, FR-REF-04~06)."""

from typing import Literal

import pydantic

from app.schemas.codes import CategoryCd, ColorCd, StyleCd
from app.services.prompt.outfit_generation import AssembledPrompt, sanitize_inline
from app.services.prompt.template import load_prompt_template, render

PROMPT_NAME = "regeneration_intent"
PROMPT_VERSION = "v1.0"
ITEM_NAME_MAX_LENGTH = 20

IntentStatus = Literal["ok", "unclear", "harmful"]
ClothingWarmth = Literal["lighter", "warmer"]


class ReplaceItem(pydantic.BaseModel):
    slot: CategoryCd
    item_name: str | None


class RegenerationIntentOutput(pydantic.BaseModel):
    status: IntentStatus
    preferred_styles: list[StyleCd]
    avoided_styles: list[StyleCd]
    preferred_colors: list[ColorCd]
    avoided_colors: list[ColorCd]
    # 결과(RegenerationIntent.replace_items)는 슬롯 dict인데 LLM 출력은 목록으로 받는다.
    # 구조화 출력 스키마에서 슬롯 코드를 dict 키로 쓰기 어려워서다
    replace_items: list[ReplaceItem]
    clothing_warmth: ClothingWarmth | None


def assemble_regeneration_intent_prompt(request_text: str) -> AssembledPrompt:
    text = sanitize_inline(request_text)
    if not text:
        raise ValueError("빈 요청 문장은 파싱할 수 없습니다.")
    template = load_prompt_template(PROMPT_NAME, PROMPT_VERSION)
    return AssembledPrompt(
        system=render(template.system, {}),
        user=render(template.user, {"request_text": text}),
        prompt_version=template.prompt_version,
    )
