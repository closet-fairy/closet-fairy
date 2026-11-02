"""재추천 의도 파싱 스모크 테스트. 실제 API를 문장 수만큼 호출한다 (비용 발생).

backend/ 폴더에서 실행한다:
    python scripts/regeneration_intent_smoke.py
.env의 ANTHROPIC_API_KEY가 필요하다.
기대한 값과 다르면 exit 1로 끝난다. 기대에 적지 않은 칸은 비교하지 않는다.
"""

from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import get_settings  # noqa: E402
from app.core.logging import setup_logging  # noqa: E402
from app.services.llm import create_llm_client  # noqa: E402
from app.services.regeneration_intent import parse_regeneration_intent  # noqa: E402

SCENARIOS: list[tuple[str, dict]] = [
    ("좀 더 캐주얼하게", {"status": "ok", "preferred_styles": ["casual"]}),
    ("검정색 옷 비율 줄여 줘", {"status": "ok", "avoided_colors": ["black"]}),
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
    ("더 편하게", {"status": "ok", "preferred_styles": ["casual"]}),
    ("더 밝게", {"status": "ok", "avoided_colors": []}),
]


async def main() -> int:
    setup_logging()
    print(f"model: {get_settings().LLM_INTENT_MODEL}")
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
            diff = {k: v for k, v in expected.items() if result[k] != v}
            ok = ok and not diff
            print(f"\n{'OK' if not diff else 'NG'} [{text}]")
            print(f"  결과: {json.dumps(result, ensure_ascii=False)}")
            if diff:
                print(f"  기대: {json.dumps(expected, ensure_ascii=False)}")
            dropped = [
                item.item_name
                for item in raw_outputs[-1].replace_items
                if item.item_name is not None and result["replace_items"].get(item.slot) is None
            ]
            if dropped:
                print(f"  버려진 물건 이름: {json.dumps(dropped, ensure_ascii=False)}")
    finally:
        await llm.aclose()
    print("\n결과:", "기대와 일치" if ok else "기대와 다름")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
