import json

import anthropic

from app.services.prompt.clothing_tagging import (
    PROMPT_NAME,
    PROMPT_VERSION,
    ClothingTaggingOutput,
    assemble_clothing_tagging_prompt,
)
from app.services.prompt.template import PROMPTS_DIR


def test_prompt_version_matches_template_folder():
    prompt = assemble_clothing_tagging_prompt()

    assert prompt.prompt_version == f"{PROMPT_NAME}/{PROMPT_VERSION}"
    assert (PROMPTS_DIR / PROMPT_NAME / PROMPT_VERSION).is_dir()


def test_schema_snapshot_matches_output_model():
    path = PROMPTS_DIR / PROMPT_NAME / PROMPT_VERSION / "schema.json"

    assert json.loads(path.read_text(encoding="utf-8")) == anthropic.transform_schema(
        ClothingTaggingOutput
    )


def test_system_prompt_example_passes_output_model():
    system = assemble_clothing_tagging_prompt().system
    example = system.split("## 출력 예시\n", 1)[1]

    output = ClothingTaggingOutput.model_validate(json.loads(example), extra="forbid")

    assert output.category == "outer"


def test_system_prompt_lists_every_allowed_code():
    system = assemble_clothing_tagging_prompt().system
    schema = anthropic.transform_schema(ClothingTaggingOutput)
    codes = []
    for name in ("category", "accessory_type", "color", "thickness"):
        codes += schema["properties"][name]["anyOf"][0]["enum"]
    for name in ("styles", "seasons"):
        codes += schema["properties"][name]["items"]["enum"]

    assert [code for code in codes if code not in system] == []
