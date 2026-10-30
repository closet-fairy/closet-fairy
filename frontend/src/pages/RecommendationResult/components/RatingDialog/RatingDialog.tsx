import type { RefObject } from 'react';
import Button from '@/components/common/Button';
import Dialog from '@/components/common/Dialog';
import StarRating from '@/components/common/StarRating';
import * as S from './RatingDialog.styled';

interface RatingDialogProps {
  isOpen: boolean;
  rating: number;
  isSubmitting: boolean;
  onRatingChange: (rating: number) => void;
  onSubmit: () => void;
  onClose: () => void;
  finalFocus?: RefObject<HTMLElement | null>;
}

const RatingDialog = (props: RatingDialogProps) => {
  const {
    isOpen,
    rating,
    isSubmitting,
    onRatingChange,
    onSubmit,
    onClose,
    finalFocus,
  } = props;

  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={() => {}}
      title="이 코디, 얼마나 마음에 드세요"
      description="별점을 매기면 다음 추천이 더 정확해집니다."
      isDismissable={false}
      finalFocus={finalFocus}
      footer={
        <>
          <Button
            isFullWidth
            isDisabled={rating === 0}
            isLoading={isSubmitting}
            onClick={onSubmit}
          >
            채택하기
          </Button>
          <Button
            variant="text"
            size="md"
            isFullWidth
            isDisabled={isSubmitting}
            onClick={onClose}
          >
            다시 볼게요
          </Button>
        </>
      }
    >
      <S.Stars>
        <StarRating
          value={rating}
          onChange={onRatingChange}
          isDisabled={isSubmitting}
          aria-label="코디 별점"
        />
      </S.Stars>
    </Dialog>
  );
};

export default RatingDialog;
