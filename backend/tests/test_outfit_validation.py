import pytest

from app.services.outfit_validation import OutfitValidation, to_failure_reasons
from app.services.prompt.outfit_generation import FailureReason, assemble_outfit_generation_prompt
from tests.test_outfit_generation_prompt import make_input


def test_only_failed_outfits_become_failure_reasons_in_seq_order():
    results = [
        OutfitValidation(4, passed=False, reasons=("러닝화를 구두로 바꾼다.",)),
        OutfitValidation(1, passed=True),
        OutfitValidation(2, passed=False, reasons=("트레이닝 팬츠를 슬랙스로 바꾼다.",)),
    ]

    assert to_failure_reasons(results) == [
        FailureReason(2, "트레이닝 팬츠를 슬랙스로 바꾼다."),
        FailureReason(4, "러닝화를 구두로 바꾼다."),
    ]


def test_multiple_reasons_become_one_failure_reason_each():
    results = [OutfitValidation(3, passed=False, reasons=("상의가 두 개다.", "신발이 없다."))]

    assert to_failure_reasons(results) == [
        FailureReason(3, "상의가 두 개다."),
        FailureReason(3, "신발이 없다."),
    ]


def test_all_passed_gives_no_failure_reasons():
    assert to_failure_reasons([OutfitValidation(1, passed=True)]) == []


def test_failure_reasons_render_in_generation_prompt():
    results = [OutfitValidation(2, passed=False, reasons=("러닝화를 구두로 바꾼다.",))]

    user = assemble_outfit_generation_prompt(
        make_input(outfit_count=1, failure_reasons=to_failure_reasons(results))
    ).user

    assert "## 직전 생성의 검증 실패 사유" in user
    assert "- 세트 2: 러닝화를 구두로 바꾼다." in user


def test_passed_with_reasons_is_rejected():
    with pytest.raises(ValueError):
        OutfitValidation(1, passed=True, reasons=("적합하다.",))


def test_failed_without_reasons_is_rejected():
    with pytest.raises(ValueError):
        OutfitValidation(1, passed=False)
