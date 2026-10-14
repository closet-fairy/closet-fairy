"""자유 입력(TPO 직접 입력, 재추천 요청) 유해 입력 검사.
프롬프트 조작과 확실한 욕설·성적·차별 표현만 패턴으로 막고,
애매한 표현은 의도 파싱의 harmful 판정에 맡긴다.
패턴은 config/input_guard/에 있고, 원문에 적용하는 파일과
정규화한 문자열에 적용하는 파일로 나뉜다."""

import re
import unicodedata
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

INPUT_GUARD_DIR = Path(__file__).resolve().parents[2] / "config" / "input_guard"
RAW_PATTERN_FILES = ("injection_patterns.txt", "abusive_raw_patterns.txt")
NORMALIZED_PATTERN_FILES = ("abusive_patterns.txt",)

_NON_LETTER = re.compile(r"[^a-z가-힣ㄱ-ㅎㅏ-ㅣ]+")
_ZERO_WIDTH = (0x200B, 0x200C, 0x200D, 0x2060, 0xFEFF)


def _build_width_table() -> dict[int, str | None]:
    table: dict[int, str | None] = {0x3000: " "}
    table.update({c: chr(c - 0xFEE0) for c in range(0xFF01, 0xFF5F)})
    for c in range(0xFFA0, 0xFFDD):
        name = unicodedata.name(chr(c), "")
        if name.startswith("HALFWIDTH HANGUL"):
            table[c] = unicodedata.lookup(name.removeprefix("HALFWIDTH "))
    table.update(dict.fromkeys(_ZERO_WIDTH))
    return table


_WIDTH_TABLE = _build_width_table()


class InputGuardConfigError(RuntimeError):
    pass


@dataclass(frozen=True)
class InputGuardPatterns:
    raw: tuple[re.Pattern[str], ...]
    normalized: tuple[re.Pattern[str], ...]


@lru_cache
def load_input_guard() -> InputGuardPatterns:
    return load_input_guard_from(INPUT_GUARD_DIR)


def load_input_guard_from(directory: Path) -> InputGuardPatterns:
    return InputGuardPatterns(
        raw=tuple(
            p for name in RAW_PATTERN_FILES for p in read_patterns(directory / name, re.IGNORECASE)
        ),
        normalized=tuple(
            p for name in NORMALIZED_PATTERN_FILES for p in read_patterns(directory / name)
        ),
    )


def read_patterns(path: Path, flags: int = 0) -> list[re.Pattern[str]]:
    patterns = []
    for line_no, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        source = line.strip()
        if not source or source.startswith("#"):
            continue
        try:
            patterns.append(re.compile(source, flags))
        except re.error as e:
            raise InputGuardConfigError(f"{path.name}:{line_no} 잘못된 정규식입니다: {e}") from e
    if not patterns:
        raise InputGuardConfigError(f"{path.name}에 패턴이 없습니다.")
    return patterns


def is_harmful(text: str) -> bool:
    patterns = load_input_guard()
    composed = unicodedata.normalize("NFC", text.translate(_WIDTH_TABLE))
    if any(p.search(composed) for p in patterns.raw):
        return True
    normalized = normalize(composed)
    return any(p.search(normalized) for p in patterns.normalized)


def normalize(text: str) -> str:
    tokens = _NON_LETTER.sub(" ", unicodedata.normalize("NFC", text).lower()).split()
    merged: list[str] = []
    prev_single = False
    for token in tokens:
        if len(token) == 1 and prev_single:
            merged[-1] += token
        else:
            merged.append(token)
        prev_single = len(token) == 1
    return " ".join(merged)
