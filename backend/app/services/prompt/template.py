import re
from collections.abc import Mapping
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import NamedTuple

# app/services/prompt/template.py → parents[3] = backend 폴더
PROMPTS_DIR = Path(__file__).resolve().parents[3] / "config" / "prompts"

_SLOT = re.compile(r"\{\{([a-z_]+)\}\}")
_BLOCK_OPEN = re.compile(r"\{\{#([a-z_]+)\}\}")
_BLOCK_CLOSE = re.compile(r"\{\{/([a-z_]+)\}\}")


class PromptTemplateError(Exception):
    pass


@dataclass(frozen=True)
class PromptTemplate:
    name: str
    version: str
    system: str
    user: str

    @property
    def prompt_version(self) -> str:
        return f"{self.name}/{self.version}"


class SlotNames(NamedTuple):
    required: frozenset[str]
    optional: frozenset[str]


@dataclass(frozen=True)
class _Block:
    name: str
    lines: tuple[str, ...]


@lru_cache
def load_prompt_template(name: str, version: str) -> PromptTemplate:
    directory = PROMPTS_DIR / name / version
    if not directory.is_dir():
        raise PromptTemplateError(f"프롬프트 템플릿이 없습니다: {name}/{version}")
    template = PromptTemplate(
        name=name,
        version=version,
        system=(directory / "system.md").read_text(encoding="utf-8"),
        user=(directory / "user.md").read_text(encoding="utf-8"),
    )
    _parse(template.system)
    _parse(template.user)
    return template


def slot_names(template: str) -> SlotNames:
    nodes = _parse(template)
    required = frozenset(
        name for node in nodes if isinstance(node, str) for name in _SLOT.findall(node)
    )
    optional = frozenset(node.name for node in nodes if isinstance(node, _Block))
    return SlotNames(required, optional)


def render(template: str, values: Mapping[str, str | None]) -> str:
    nodes = _parse(template)
    required, optional = slot_names(template)

    unknown = (required | optional) - values.keys()
    if unknown:
        raise PromptTemplateError(f"값이 정의되지 않은 슬롯: {sorted(unknown)}")
    extra = values.keys() - (required | optional)
    if extra:
        raise PromptTemplateError(f"템플릿에 없는 슬롯: {sorted(extra)}")
    missing = [name for name in sorted(required) if _is_empty(values[name])]
    if missing:
        raise PromptTemplateError(f"필수 슬롯이 비었습니다: {missing}")

    # 값에는 회원 자유 입력이 들어오므로 한 번만 치환해, 값 안의 {{slot}}이 다시 펼쳐지지 않게 한다
    def substitute(line: str) -> str:
        return _SLOT.sub(lambda m: values[m.group(1)], line)

    lines: list[str] = []
    for node in nodes:
        if isinstance(node, _Block):
            if not _is_empty(values[node.name]):
                lines.extend(substitute(line) for line in node.lines)
        else:
            lines.append(substitute(node))
    return "\n".join(lines).rstrip("\n")


def _is_empty(value: str | None) -> bool:
    return value is None or not value.strip()


@lru_cache
def _parse(template: str) -> tuple[str | _Block, ...]:
    nodes: list[str | _Block] = []
    block_names: set[str] = set()
    current_name: str | None = None
    current_lines: list[str] = []

    for line in template.split("\n"):
        opening = _BLOCK_OPEN.fullmatch(line)
        closing = _BLOCK_CLOSE.fullmatch(line)
        if opening:
            if current_name is not None:
                raise PromptTemplateError(f"블록은 중첩할 수 없습니다: {opening.group(1)}")
            current_name = opening.group(1)
            if current_name in block_names:
                raise PromptTemplateError(f"같은 이름의 블록이 두 번 있습니다: {current_name}")
            block_names.add(current_name)
            current_lines = []
            continue
        if closing:
            if closing.group(1) != current_name:
                raise PromptTemplateError(f"블록의 짝이 맞지 않습니다: {closing.group(1)}")
            if current_name not in _SLOT.findall("\n".join(current_lines)):
                raise PromptTemplateError(f"블록 안에 같은 이름의 슬롯이 없습니다: {current_name}")
            nodes.append(_Block(current_name, tuple(current_lines)))
            current_name = None
            continue
        if "{{" in _SLOT.sub("", line):
            raise PromptTemplateError(f"슬롯 표기가 올바르지 않습니다: {line!r}")
        if current_name is None:
            nodes.append(line)
            continue
        others = set(_SLOT.findall(line)) - {current_name}
        if others:
            raise PromptTemplateError(
                f"블록 {current_name} 안에 다른 슬롯이 있습니다: {sorted(others)}"
            )
        current_lines.append(line)

    if current_name is not None:
        raise PromptTemplateError(f"블록이 닫히지 않았습니다: {current_name}")

    required = {name for node in nodes if isinstance(node, str) for name in _SLOT.findall(node)}
    both = required & block_names
    if both:
        raise PromptTemplateError(f"필수 슬롯과 선택 블록에 함께 쓰였습니다: {sorted(both)}")
    return tuple(nodes)
