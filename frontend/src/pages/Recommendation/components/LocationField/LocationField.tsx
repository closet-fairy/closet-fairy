import type { Ref } from 'react';
import { useContext, useId } from 'react';
import Icon from '@/components/common/Icon';
import { FormFieldContext } from '@/components/common/FormField/FormField.context';
import { formatRegionLabel } from '@/domains/recommendation/regionLabel';
import type { RecommendationLocation } from '../../types';
import WeatherSummary from '../WeatherSummary';
import * as S from './LocationField.styled';

interface LocationFieldProps {
  location: RecommendationLocation | null;
  onClick: () => void;
  ref?: Ref<HTMLButtonElement>;
}

const LocationField = (props: LocationFieldProps) => {
  const { location, onClick, ref } = props;

  const formField = useContext(FormFieldContext);
  const contentId = useId();
  const labelledBy = [formField?.labelId, contentId]
    .filter((id) => id !== undefined)
    .join(' ');

  return (
    <S.Trigger
      ref={ref}
      type="button"
      aria-haspopup="dialog"
      aria-labelledby={labelledBy}
      aria-describedby={formField?.hintId}
      onClick={onClick}
    >
      <Icon name="location_on" size="md" />
      <S.Content id={contentId}>
        {location ? (
          <>
            <S.Value>
              {formatRegionLabel(location.sidoNm, location.sigunguNm)}
            </S.Value>
            <WeatherSummary
              sidoNm={location.sidoNm}
              sigunguNm={location.sigunguNm}
            />
          </>
        ) : (
          <S.Placeholder>위치를 선택하세요</S.Placeholder>
        )}
      </S.Content>
      <S.Chevron>
        <Icon name="chevron_right" size="md" />
      </S.Chevron>
    </S.Trigger>
  );
};

export default LocationField;
