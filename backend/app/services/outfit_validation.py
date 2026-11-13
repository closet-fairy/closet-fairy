from collections.abc import Sequence
from dataclasses import dataclass

from app.services.prompt.outfit_generation import FailureReason


@dataclass(frozen=True)
class OutfitValidation:
    outfit_seq: int
    passed: bool
    reasons: tuple[str, ...] = ()
    # 아이템을 그대로 두고 코디 유형·removed_accessory_id·양말만 고치면 풀리는 탈락.
    # 이런 조합은 탈락 조합으로 누적하지 않는다
    fixable_without_items: bool = False

    def __post_init__(self) -> None:
        if self.passed and self.reasons:
            raise ValueError(f"통과한 세트에는 실패 사유가 없어야 합니다: 세트 {self.outfit_seq}")
        if not self.passed and not self.reasons:
            raise ValueError(f"실패한 세트에는 실패 사유가 있어야 합니다: 세트 {self.outfit_seq}")


def to_failure_reasons(results: Sequence[OutfitValidation]) -> list[FailureReason]:
    return [
        FailureReason(outfit_seq=result.outfit_seq, reason=reason)
        for result in sorted(results, key=lambda r: r.outfit_seq)
        if not result.passed
        for reason in result.reasons
    ]
