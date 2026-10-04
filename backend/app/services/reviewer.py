from collections import Counter
from collections.abc import Sequence

from app.core.config import get_settings
from app.services.llm import LLMCallConfig, LLMClient, LLMSchemaError
from app.services.outfit_validation import OutfitValidation
from app.services.prompt.outfit_review import (
    OutfitReviewInput,
    OutfitReviewOutput,
    ReviewTarget,
    assemble_outfit_review_prompt,
)

CALL_NAME = "outfit_review"


async def review_outfits(llm: LLMClient, data: OutfitReviewInput) -> list[OutfitValidation]:
    if not data.outfits:
        return []
    prompt = assemble_outfit_review_prompt(data)
    output = await llm.call_structured(
        LLMCallConfig(
            call_name=CALL_NAME,
            prompt_version=prompt.prompt_version,
            model=get_settings().LLM_REVIEWER_MODEL,
            max_tokens=2048,
            temperature=0.0,
        ),
        system=prompt.system,
        messages=[{"role": "user", "content": prompt.user}],
        output_model=OutfitReviewOutput,
    )
    return map_review_output(data.outfits, output)


def map_review_output(
    targets: Sequence[ReviewTarget], output: OutfitReviewOutput
) -> list[OutfitValidation]:
    expected = {t.outfit_seq for t in targets}
    counts = Counter(r.outfit_seq for r in output.reviews)
    duplicated = sorted(seq for seq, count in counts.items() if count > 1)
    if duplicated:
        raise LLMSchemaError(f"reviewer output has duplicated outfit_seq: {duplicated}")
    if counts.keys() != expected:
        missing = sorted(expected - counts.keys())
        unexpected = sorted(counts.keys() - expected)
        raise LLMSchemaError(
            f"reviewer output outfit_seq mismatch: missing {missing}, unexpected {unexpected}"
        )

    results: list[OutfitValidation] = []
    for review in sorted(output.reviews, key=lambda r: r.outfit_seq):
        if review.passed:
            results.append(OutfitValidation(review.outfit_seq, passed=True))
            continue
        reason = review.reason.strip()
        if not reason:
            raise LLMSchemaError(
                f"reviewer output has empty reason (outfit_seq {review.outfit_seq})"
            )
        results.append(OutfitValidation(review.outfit_seq, passed=False, reasons=(reason,)))
    return results
