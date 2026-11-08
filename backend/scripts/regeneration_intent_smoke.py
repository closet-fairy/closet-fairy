"""재추천 의도 파싱 스모크 테스트. 실제 API를 문장 수만큼 호출한다 (비용 발생).

backend/ 폴더에서 실행한다:
    python scripts/regeneration_intent_smoke.py
    python scripts/regeneration_intent_smoke.py --prompt-version v1.1  # 이전 버전과 비교
--prompt-version은 프롬프트 문구만 바꾸고 출력 스키마는 지금 코드의 모델로 보낸다.
출력 칸이 다른 버전(v1.x)의 실제 동작은 그 버전의 코드에서 돌려야 한다.
.env의 ANTHROPIC_API_KEY가 필요하다.
기대한 값과 다르면 exit 1로 끝난다. 기대에 적지 않은 칸은 비교하지 않는다.
함수로 적은 기대는 결과 전체를 받아 참이면 통과다.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import get_settings  # noqa: E402
from app.core.logging import setup_logging  # noqa: E402
from app.services.llm import create_llm_client  # noqa: E402
from app.services.prompt import regeneration_intent as intent_prompt  # noqa: E402
from app.services.regeneration_intent import (  # noqa: E402
    build_ok_intent,
    find_unclear_reason,
    parse_regeneration_intent,
)

NO_PREFERRED_STYLES = {"preferred_styles": [], "inferred_preferred_styles": []}
NO_PREFERRED_COLORS = {"preferred_colors": [], "inferred_preferred_colors": []}

SCENARIOS: list[tuple[str, dict]] = [
    (
        "좀 더 캐주얼하게",
        {"status": "ok", "preferred_styles": ["casual"], "inferred_preferred_styles": []},
    ),
    (
        "검정색 옷 비율 줄여 줘",
        {
            "status": "ok",
            "avoided_colors": ["black"],
            "preferred_colors": [],
            "inferred_preferred_colors": [],
        },
    ),
    ("덜 더워 보이게", {"status": "ok", "clothing_warmth": "lighter"}),
    (
        "하의만 청바지로",
        {"status": "ok", "replace_items": {"bottom": "청바지"}, "preferred_colors": []},
    ),
    (
        "하의를 청바지로 바꿔 줘",
        {"status": "ok", "replace_items": {"bottom": "청바지"}, "preferred_colors": []},
    ),
    (
        "신발을 흰 운동화로 바꿔 줘",
        {"status": "ok", "replace_items": {"shoes": "흰 운동화"}, "preferred_colors": []},
    ),
    ("하의만 바꿔 줘", {"status": "ok", "replace_items": {"bottom": None}}),
    ("더 캐주얼하고 더 포멀하게", {"status": "ok", "preferred_styles": ["formal"]}),
    ("오늘 점심 뭐 먹을지 추천해 줘", {"status": "unclear"}),
    ("컬러풀하게 바꿔 주세요", {"status": "ok"}),
    ("칙칙하지 않게", {"status": "ok"}),
    ("깔끔하게", {"status": "ok"}),
    (
        "더 편하게",
        {"status": "ok", "preferred_styles": [], "inferred_preferred_styles": ["casual"]},
    ),
    ("더 밝게", {"status": "ok", "avoided_colors": [], "preferred_colors": []}),
    ("좀 더 자연스럽게", {"status": "ok", "avoided_styles": []}),
    (
        "편안한 느낌으로",
        {"status": "ok", "preferred_styles": [], "inferred_preferred_styles": ["casual"]},
    ),
    (
        "덜 차려입은 느낌으로",
        {
            "status": "ok",
            "preferred_styles": [],
            "inferred_preferred_styles": ["casual"],
            "avoided_styles": [],
        },
    ),
    ("좀 내추럴하게", {"status": "ok"}),
    ("꾸안꾸 느낌으로", {"status": "ok"}),
    ("너무 차려입은 것 같아", {"status": "ok", "avoided_styles": []}),
    (
        "격식 있게",
        {
            "status": "ok",
            "preferred_styles": lambda r: "formal" in r["preferred_styles"],
            "avoided_styles": [],
        },
    ),
    ("단정한 느낌으로", {"status": "ok", "avoided_styles": []}),
    ("알아서 예쁘게", {"status": "unclear"}),
    ("더 좋게", {"status": "unclear"}),
    ("내일 날씨 어때?", {"status": "unclear"}),
    ("톤다운으로", {"status": "ok", "preferred_colors": [], "avoided_colors": []}),
    (
        "블랙으로 바꿔 줘",
        {"status": "ok", "preferred_colors": ["black"], "inferred_preferred_colors": []},
    ),
    (
        "블랙 말고 톤다운으로",
        {"status": "ok", "avoided_colors": ["black"], "preferred_colors": []},
    ),
    (
        "네이비 위주로",
        {"status": "ok", "preferred_colors": ["navy"], "inferred_preferred_colors": []},
    ),
    (
        "까만 옷 위주로",
        {"status": "ok", "preferred_colors": ["black"], "inferred_preferred_colors": []},
    ),
    (
        "그레이로 맞춰 줘",
        {"status": "ok", "preferred_colors": ["gray"], "inferred_preferred_colors": []},
    ),
    (
        "스트리트 패션으로",
        {"status": "ok", "preferred_styles": ["street"], "inferred_preferred_styles": []},
    ),
    (
        "레트로하게",
        {
            "status": "ok",
            "preferred_styles 또는 inferred_preferred_styles": lambda r: (
                "vintage" in r["preferred_styles"] + r["inferred_preferred_styles"]
            ),
        },
    ),
    *(
        (text, {"status": "ok", "avoided_styles": [style], **NO_PREFERRED_STYLES})
        for text, style in [
            ("격식 빼고", "formal"),
            ("스포티하지 않게", "sporty"),
            ("페미닌하지 않게", "feminine"),
        ]
    ),
    (
        "격식 없게 입고 싶어",
        {
            "status": "ok",
            "avoided_styles에 formal 또는 preferred_styles에 casual": lambda r: (
                "formal" in r["avoided_styles"] or "casual" in r["preferred_styles"]
            ),
        },
    ),
    *(
        (text, {"status": "ok", "avoided_colors": [color], **NO_PREFERRED_COLORS})
        for text, color in [
            ("까맣지 않게", "black"),
            ("하얗지 않게", "white"),
            ("네이비는 피하고 싶어", "navy"),
        ]
    ),
    ("차분한 느낌으로", {"status": "ok", "preferred_styles": [], "preferred_colors": []}),
    ("좀 더 화사하게", {"status": "ok", "preferred_styles": [], "preferred_colors": []}),
    ("세련되게", {"status": "ok", "preferred_styles": [], "preferred_colors": []}),
]


UNCLEAR_REASON_TEXT = {
    "empty": "칸이 모두 비어 unclear로 바뀜",
    "contradictory": "같은 값이 선호·기피에 함께 있어 unclear로 바뀜",
}


async def main(prompt_version: str | None) -> int:
    setup_logging()
    if prompt_version:
        intent_prompt.PROMPT_VERSION = prompt_version
    print(f"model: {get_settings().LLM_INTENT_MODEL}")
    print(f"prompt: {intent_prompt.PROMPT_NAME}/{intent_prompt.PROMPT_VERSION}")
    llm = create_llm_client(get_settings())
    raw_outputs = []
    call_structured = llm.call_structured

    async def capture(*args, **kwargs):
        output = await call_structured(*args, **kwargs)
        raw_outputs.append(output)
        return output

    llm.call_structured = capture
    ok = True
    try:
        for text, expected in SCENARIOS:
            result = (await parse_regeneration_intent(llm, text)).to_dict()
            diff = {
                k: v
                for k, v in expected.items()
                if not (v(result) if callable(v) else result[k] == v)
            }
            ok = ok and not diff
            print(f"\n{'OK' if not diff else 'NG'} [{text}]")
            print(f"  결과: {json.dumps(result, ensure_ascii=False)}")
            if diff:
                shown = json.dumps(expected, ensure_ascii=False, default=lambda _: "조건")
                print(f"  기대: {shown}")
            raw = raw_outputs[-1]
            if raw.status == "ok" and result["status"] == "unclear":
                reason = find_unclear_reason(build_ok_intent(raw))
                cause = UNCLEAR_REASON_TEXT.get(reason, f"unclear로 바뀜: {reason}")
                print(f"  LLM status: ok ({cause})")
            dropped = [
                item.item_name
                for item in raw.replace_items
                if item.item_name is not None and result["replace_items"].get(item.slot) is None
            ]
            if dropped:
                print(f"  버려진 물건 이름: {json.dumps(dropped, ensure_ascii=False)}")
            dropped_inferred = [
                v
                for name in ("inferred_preferred_styles", "inferred_preferred_colors")
                for v in getattr(raw, name)
                if result["status"] == "ok" and v not in result[name]
            ]
            if dropped_inferred:
                print(f"  빠진 풀어서 채운 값: {json.dumps(dropped_inferred, ensure_ascii=False)}")
    finally:
        await llm.aclose()
    print("\n결과:", "기대와 일치" if ok else "기대와 다름")
    return 0 if ok else 1


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--prompt-version", help="예: v1.1. 생략하면 코드의 PROMPT_VERSION")
    args = parser.parse_args()
    sys.exit(asyncio.run(main(args.prompt_version)))
