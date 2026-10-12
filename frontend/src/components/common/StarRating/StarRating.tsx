import { useContext, useId } from 'react';
import { FormFieldContext } from '@/components/common/FormField/FormField.context';
import Icon from '@/components/common/Icon';
import * as S from './StarRating.styled';

type StarRatingSize = 'md' | 'sm';

interface StarRatingBaseProps {
  value: number;
  'aria-label'?: string;
}

interface StarRatingInputProps extends StarRatingBaseProps {
  onChange: (value: number) => void;
  isReadOnly?: false;
  isDisabled?: boolean;
  size?: 'md';
}

interface StarRatingReadOnlyProps extends StarRatingBaseProps {
  onChange?: never;
  isReadOnly: true;
  isDisabled?: never;
  size?: StarRatingSize;
}

type StarRatingProps = StarRatingInputProps | StarRatingReadOnlyProps;

const MAX_RATING = 5;
const RATINGS = Array.from({ length: MAX_RATING }, (_, index) => index + 1);

const StarRating = (props: StarRatingProps) => {
  const {
    value,
    onChange,
    isReadOnly = false,
    isDisabled = false,
    'aria-label': ariaLabelProp,
    size = 'md',
  } = props;

  const name = useId();
  const formField = useContext(FormFieldContext);
  const ariaLabel = ariaLabelProp ?? '별점';
  const isLabelledByField = ariaLabelProp === undefined && formField !== null;

  const readOnlyLabel = `${ariaLabel} ${MAX_RATING}점 중 ${value}점`;

  if (size === 'sm') {
    return (
      <S.CompactDisplay role="img" aria-label={readOnlyLabel}>
        <Icon name="star-fill" size="xs" />
        {value}
      </S.CompactDisplay>
    );
  }

  if (isReadOnly) {
    return (
      <S.Display role="img" aria-label={readOnlyLabel}>
        {RATINGS.map((rating) => (
          <S.DisplayStar key={rating} $isFilled={rating <= value}>
            <Icon name={rating <= value ? 'star-fill' : 'star'} size="xl" />
          </S.DisplayStar>
        ))}
      </S.Display>
    );
  }

  return (
    <S.Fieldset
      disabled={isDisabled}
      aria-labelledby={isLabelledByField ? formField.labelId : undefined}
      aria-describedby={formField?.hintId}
    >
      {!isLabelledByField && <S.Legend>{ariaLabel}</S.Legend>}
      <S.Stars>
        {RATINGS.map((rating) => (
          <S.StarLabel
            key={rating}
            $isFilled={rating <= value}
            $isDisabled={isDisabled}
          >
            <S.HiddenRadio
              type="radio"
              name={name}
              value={rating}
              checked={rating === value}
              onChange={() => onChange?.(rating)}
              aria-label={`별 ${rating}개`}
            />
            <Icon name={rating <= value ? 'star-fill' : 'star'} size="xl" />
          </S.StarLabel>
        ))}
      </S.Stars>
    </S.Fieldset>
  );
};

export default StarRating;
