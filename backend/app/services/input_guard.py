"""자유 입력(TPO 텍스트) 유해 입력 검사. 1차 버전은 금지 패턴 목록 방식.
LLM에 그대로 들어가는 문자열이라 프롬프트 조작 시도를 막는 게 주목적."""
import re

BLOCKED_PATTERNS = [
    r"ignore (all |the )?(previous|above)",
    r"system prompt",
    r"시스템 ?프롬프트",
    r"(이전|위의?) ?(지시|명령).{0,6}(무시|잊어)",
    r"<\s*script",
]
_BLOCKED = [re.compile(p, re.IGNORECASE) for p in BLOCKED_PATTERNS]


def is_harmful(text: str) -> bool:
    return any(p.search(text) for p in _BLOCKED)
