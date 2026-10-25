import CheckList from '@/components/common/CheckList';
import type { StyleCd } from '@/domains/member/memberSettingOptions';
import {
  isStyleCd,
  STYLE_OPTIONS,
} from '@/domains/member/memberSettingOptions';

interface StylePreferenceListProps {
  value: StyleCd[];
  onChange: (value: StyleCd[]) => void;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  isDisabled?: boolean;
}

const StylePreferenceList = (props: StylePreferenceListProps) => {
  const {
    value,
    onChange,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
    isDisabled = false,
  } = props;

  return (
    <CheckList
      items={STYLE_OPTIONS}
      value={value}
      onChange={(nextValue) => onChange(nextValue.filter(isStyleCd))}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      isDisabled={isDisabled}
    />
  );
};

export default StylePreferenceList;
