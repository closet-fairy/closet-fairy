import pytest

from app.services.prompt.template import (
    PROMPTS_DIR,
    PromptTemplateError,
    load_prompt_template,
    render,
    slot_names,
)

TEMPLATE = """## 기본
{{base}}

{{#extra}}
## 추가
{{extra}}

{{/extra}}
## 끝
{{tail}}
"""


def test_render_fills_required_and_optional_slots():
    result = render(TEMPLATE, {"base": "A", "extra": "B", "tail": "C"})

    assert result == "## 기본\nA\n\n## 추가\nB\n\n## 끝\nC"


@pytest.mark.parametrize("empty", [None, "", "  \n"])
def test_render_removes_empty_optional_block_with_heading(empty):
    result = render(TEMPLATE, {"base": "A", "extra": empty, "tail": "C"})

    assert result == "## 기본\nA\n\n## 끝\nC"


def test_slot_names_split_required_and_optional():
    assert slot_names(TEMPLATE) == ({"base", "tail"}, {"extra"})


@pytest.mark.parametrize("empty", [None, "", " "])
def test_render_rejects_empty_required_slot(empty):
    with pytest.raises(PromptTemplateError, match="필수 슬롯이 비었습니다"):
        render(TEMPLATE, {"base": empty, "extra": None, "tail": "C"})


def test_render_rejects_slot_without_value():
    with pytest.raises(PromptTemplateError, match="값이 정의되지 않은 슬롯: \\['extra'\\]"):
        render(TEMPLATE, {"base": "A", "tail": "C"})


def test_render_rejects_value_not_in_template():
    with pytest.raises(PromptTemplateError, match="템플릿에 없는 슬롯: \\['unknown'\\]"):
        render(TEMPLATE, {"base": "A", "extra": None, "tail": "C", "unknown": "X"})


def test_render_does_not_expand_slots_inside_values():
    result = render(TEMPLATE, {"base": "{{tail}}", "extra": None, "tail": "C"})

    assert result.startswith("## 기본\n{{tail}}\n")


@pytest.mark.parametrize(
    ("template", "message"),
    [
        ("{{#a}}\n{{a}}\n", "블록이 닫히지 않았습니다"),
        ("{{a}}\n{{/a}}\n", "블록의 짝이 맞지 않습니다"),
        ("{{#a}}\n{{#b}}\n{{b}}\n{{/b}}\n{{a}}\n{{/a}}\n", "블록은 중첩할 수 없습니다"),
        ("{{#a}}\n고정 문구\n{{/a}}\n", "블록 안에 같은 이름의 슬롯이 없습니다"),
        ("{{#a}}\n{{a}} {{b}}\n{{/a}}\n", "블록 a 안에 다른 슬롯이 있습니다"),
        ("{{#a}} 제목\n{{a}}\n{{/a}}\n", "슬롯 표기가 올바르지 않습니다"),
        ("{{ a }}\n", "슬롯 표기가 올바르지 않습니다"),
        ("{{a}}\n{{#a}}\n{{a}}\n{{/a}}\n", "필수 슬롯과 선택 블록에 함께 쓰였습니다"),
        ("{{#a}}\n{{a}}\n{{/a}}\n{{#a}}\n{{a}}\n{{/a}}\n", "같은 이름의 블록이 두 번 있습니다"),
    ],
)
def test_render_rejects_malformed_template(template, message):
    with pytest.raises(PromptTemplateError, match=message):
        render(template, {})


def test_load_prompt_template_reads_versioned_folder():
    template = load_prompt_template("outfit_generation", "v1.0")

    assert template.prompt_version == "outfit_generation/v1.0"
    assert template.user == (PROMPTS_DIR / "outfit_generation" / "v1.0" / "user.md").read_text(
        encoding="utf-8"
    )


def test_load_prompt_template_rejects_unknown_version():
    with pytest.raises(PromptTemplateError, match="프롬프트 템플릿이 없습니다"):
        load_prompt_template("outfit_generation", "v0.0")
