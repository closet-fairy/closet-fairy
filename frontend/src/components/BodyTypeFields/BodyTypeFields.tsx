import Chip from '@/components/common/Chip';
import ChipGroup from '@/components/common/ChipGroup';
import FormField from '@/components/common/FormField';
import type {
  GenderCd,
  TemperatureSensitivityCd,
} from '@/domains/member/memberSettingOptions';
import {
  GENDER_OPTIONS,
  isGenderCd,
  isTemperatureSensitivityCd,
  TEMPERATURE_SENSITIVITY_OPTIONS,
} from '@/domains/member/memberSettingOptions';
import * as S from './BodyTypeFields.styled';

interface BodyTypeFieldsProps {
  temperatureSensitivity: TemperatureSensitivityCd | null;
  gender: GenderCd | null;
  onTemperatureSensitivityChange: (
    value: TemperatureSensitivityCd | null,
  ) => void;
  onGenderChange: (value: GenderCd | null) => void;
  isGenderDeselectable?: boolean;
  isDisabled?: boolean;
}

const BodyTypeFields = (props: BodyTypeFieldsProps) => {
  const {
    temperatureSensitivity,
    gender,
    onTemperatureSensitivityChange,
    onGenderChange,
    isGenderDeselectable = true,
    isDisabled = false,
  } = props;

  const genderChips = GENDER_OPTIONS.map((option) => (
    <Chip key={option.value} value={option.value}>
      {option.label}
    </Chip>
  ));

  const handleGenderChange = (value: string | null) => {
    onGenderChange(value !== null && isGenderCd(value) ? value : null);
  };

  return (
    <S.Container>
      <FormField label="체질">
        <ChipGroup
          value={temperatureSensitivity}
          isDeselectable
          isDisabled={isDisabled}
          onChange={(value) =>
            onTemperatureSensitivityChange(
              value !== null && isTemperatureSensitivityCd(value)
                ? value
                : null,
            )
          }
        >
          {TEMPERATURE_SENSITIVITY_OPTIONS.map((option) => (
            <Chip key={option.value} value={option.value}>
              {option.label}
            </Chip>
          ))}
        </ChipGroup>
      </FormField>
      <FormField label="성별">
        {isGenderDeselectable ? (
          <ChipGroup
            value={gender}
            isDeselectable
            isDisabled={isDisabled}
            onChange={handleGenderChange}
          >
            {genderChips}
          </ChipGroup>
        ) : (
          <ChipGroup
            value={gender}
            isDisabled={isDisabled}
            onChange={handleGenderChange}
          >
            {genderChips}
          </ChipGroup>
        )}
      </FormField>
    </S.Container>
  );
};

export default BodyTypeFields;
