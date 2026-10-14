"""재추천 요청 문장을 선호·기피·슬롯 교체·체감 방향으로 구조화한다 (#83, FR-REF-04~06)."""

import re
from typing import Any

import pydantic

from app.core.config import get_settings
from app.schemas.codes import CategoryCd, ColorCd, StyleCd
from app.services.input_guard import is_harmful
from app.services.llm import LLMCallConfig, LLMClient
from app.services.prompt.outfit_generation import sanitize_inline
from app.services.prompt.regeneration_intent import (
    ITEM_NAME_MAX_LENGTH,
    ClothingWarmth,
    IntentStatus,
    RegenerationIntentOutput,
    assemble_regeneration_intent_prompt,
)

CALL_NAME = "regeneration_intent"

_ITEM_NAME_FORBIDDEN_CHARS = re.compile(r"[.,!?;:\"'`<>{}\[\]()=*#@$%^~\\]")
_ITEM_NAME_SENTENCE_ENDING = re.compile(
    r"(줘|주세요|세요|해요|어요|아요|니다|하라|해라|하다|해|게)$"
)


class RegenerationIntent(pydantic.BaseModel):
    model_config = pydantic.ConfigDict(frozen=True, extra="forbid")

    status: IntentStatus
    preferred_styles: tuple[StyleCd, ...] = ()
    avoided_styles: tuple[StyleCd, ...] = ()
    preferred_colors: tuple[ColorCd, ...] = ()
    avoided_colors: tuple[ColorCd, ...] = ()
    replace_items: dict[CategoryCd, str | None] = {}
    clothing_warmth: ClothingWarmth | None = None

    @property
    def replace_slots(self) -> tuple[CategoryCd, ...]:
        return tuple(self.replace_items)

    def to_dict(self) -> dict[str, Any]:
        return self.model_dump(mode="json")

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "RegenerationIntent":
        return cls.model_validate(data)


async def parse_regeneration_intent(llm: LLMClient, request_text: str) -> RegenerationIntent:
    settings = get_settings()
    prompt = assemble_regeneration_intent_prompt(request_text)
    output = await llm.call_structured(
        LLMCallConfig(
            call_name=CALL_NAME,
            prompt_version=prompt.prompt_version,
            model=settings.LLM_INTENT_MODEL,
            max_tokens=512,
            temperature=0.0,
            timeout_s=settings.REGENERATION_INTENT_TIMEOUT_S,
            max_attempts=settings.REGENERATION_INTENT_MAX_ATTEMPTS,
        ),
        system=prompt.system,
        messages=[{"role": "user", "content": prompt.user}],
        output_model=RegenerationIntentOutput,
    )
    return to_regeneration_intent(output)


def to_regeneration_intent(output: RegenerationIntentOutput) -> RegenerationIntent:
    if output.status != "ok":
        return RegenerationIntent(status=output.status)

    replace_items: dict[CategoryCd, str | None] = {}
    for item in output.replace_items:
        name = clean_item_name(item.item_name)
        if name is None and replace_items.get(item.slot) is not None:
            continue
        replace_items[item.slot] = name

    intent = RegenerationIntent(
        status="ok",
        preferred_styles=tuple(dict.fromkeys(output.preferred_styles)),
        avoided_styles=tuple(dict.fromkeys(output.avoided_styles)),
        preferred_colors=tuple(dict.fromkeys(output.preferred_colors)),
        avoided_colors=tuple(dict.fromkeys(output.avoided_colors)),
        replace_items=replace_items,
        clothing_warmth=output.clothing_warmth,
    )
    if _is_empty(intent) or _is_contradictory(intent):
        return RegenerationIntent(status="unclear")
    return intent


def clean_item_name(value: str | None) -> str | None:
    if value is None:
        return None
    name = sanitize_inline(value)
    if (
        not name
        or len(name) > ITEM_NAME_MAX_LENGTH
        or is_harmful(name)
        or _ITEM_NAME_FORBIDDEN_CHARS.search(name)
        or _ITEM_NAME_SENTENCE_ENDING.search(name)
    ):
        return None
    return name


def _is_empty(intent: RegenerationIntent) -> bool:
    return not (
        intent.preferred_styles
        or intent.avoided_styles
        or intent.preferred_colors
        or intent.avoided_colors
        or intent.replace_items
        or intent.clothing_warmth
    )


def _is_contradictory(intent: RegenerationIntent) -> bool:
    return bool(
        set(intent.preferred_styles) & set(intent.avoided_styles)
        or set(intent.preferred_colors) & set(intent.avoided_colors)
    )
