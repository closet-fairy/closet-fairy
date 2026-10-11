"""자동 태깅 서비스 테스트. LLM은 가짜로 바꿔 끼운다."""

import base64
import io

import pytest
from PIL import Image

from app.repositories.clothing_job import ClothingTags
from app.services.clothing_tagging import (
    BACKGROUND_RGB,
    CALL_NAME,
    ClothingTagger,
    prepare_tagging_image,
    to_clothing_tags,
)
from app.services.prompt.clothing_tagging import ClothingTaggingOutput


def _cutout(size=(400, 200)) -> bytes:
    image = Image.new("RGBA", size, (0, 0, 0, 0))
    for x in range(size[0] // 4, size[0] * 3 // 4):
        for y in range(size[1] // 4, size[1] * 3 // 4):
            image.putpixel((x, y), (20, 30, 120, 255))
    out = io.BytesIO()
    image.save(out, format="WEBP", lossless=True)
    return out.getvalue()


def _output(**overrides) -> ClothingTaggingOutput:
    values = {
        "category": "outer",
        "accessory_type": None,
        "item_name": "네이비 울 코트",
        "color": "navy",
        "color_text": "네이비",
        "styles": ["classic", "minimal"],
        "seasons": ["fall", "winter"],
        "thickness": "thick",
        "is_waterproof": False,
    }
    return ClothingTaggingOutput(**(values | overrides))


class _FakeLLM:
    def __init__(self, output):
        self.calls = []
        self._output = output

    async def call_structured(self, config, system, messages, output_model):
        self.calls.append((config, system, messages, output_model))
        return self._output


def test_prepare_fills_transparent_background_with_gray():
    image = Image.open(io.BytesIO(prepare_tagging_image(_cutout(), max_side=1024)))

    assert image.format == "JPEG"
    assert image.mode == "RGB"
    assert image.size == (400, 200)
    assert all(abs(a - b) <= 3 for a, b in zip(image.getpixel((2, 2)), BACKGROUND_RGB))
    center = image.getpixel((200, 100))
    assert center[2] > 100 and center[0] < 60


def test_prepare_shrinks_long_side_to_max_side():
    image = Image.open(io.BytesIO(prepare_tagging_image(_cutout((2000, 1000)), max_side=1024)))

    assert image.size == (1024, 512)


def test_to_clothing_tags_maps_fields():
    assert to_clothing_tags(_output()) == ClothingTags(
        category_cd="outer",
        accessory_type_cd=None,
        item_name="네이비 울 코트",
        color_cd="navy",
        color_text="네이비",
        style_cds=("classic", "minimal"),
        season_cds=("fall", "winter"),
        thickness_cd="thick",
        is_waterproof=False,
    )


@pytest.mark.parametrize(
    ("category", "expected"), [("accessories", "bag"), ("top", None), (None, None)]
)
def test_accessory_type_is_kept_only_for_accessories(category, expected):
    tags = to_clothing_tags(_output(category=category, accessory_type="bag"))

    assert tags.accessory_type_cd == expected


def test_duplicated_styles_and_seasons_are_removed_in_order():
    tags = to_clothing_tags(
        _output(styles=["casual", "street", "casual"], seasons=["summer", "summer"])
    )

    assert tags.style_cds == ("casual", "street")
    assert tags.season_cds == ("summer",)


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("  흰   티셔츠 ", "흰 티셔츠"),
        ("   ", None),
        (None, None),
        ("가" * 150, "가" * 100),
    ],
)
def test_item_name_is_trimmed_and_cut_to_column_length(raw, expected):
    assert to_clothing_tags(_output(item_name=raw)).item_name == expected


def test_color_text_is_cut_to_column_length():
    assert to_clothing_tags(_output(color_text="가" * 40)).color_text == "가" * 30


def test_unrecognized_output_maps_to_empty_tags():
    output = _output(
        category=None,
        item_name=None,
        color=None,
        color_text=None,
        styles=[],
        seasons=[],
        thickness=None,
        is_waterproof=None,
    )

    assert to_clothing_tags(output).is_empty


async def test_tag_sends_image_with_configured_model():
    llm = _FakeLLM(_output())
    tagger = ClothingTagger(llm, "claude-haiku-4-5", image_max_side=1024)

    tags = await tagger.tag(_cutout())

    config, system, messages, output_model = llm.calls[0]
    assert tags.category_cd == "outer"
    assert config.call_name == CALL_NAME
    assert config.model == "claude-haiku-4-5"
    assert config.prompt_version == "clothing_tagging/v1.0"
    assert output_model is ClothingTaggingOutput
    assert "회색 바탕" in system
    image_block, text_block = messages[0]["content"]
    assert image_block["source"]["media_type"] == "image/jpeg"
    sent = Image.open(io.BytesIO(base64.b64decode(image_block["source"]["data"])))
    assert sent.size == (400, 200)
    assert text_block["type"] == "text"
