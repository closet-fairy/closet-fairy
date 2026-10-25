import Tag from '@/components/common/Tag';
import { toAgeGroup } from '@/domains/member/birthYear';
import {
  getGenderLabel,
  getStyleLabel,
  getTemperatureSensitivityLabel,
  sortStyleCds,
} from '@/domains/member/memberSettingOptions';
import type { MemberSettingsOutput } from '@/generated/models';
import * as S from './SettingSummary.styled';

const EMPTY_LABEL = '선택 안 함';

interface SettingSummaryProps {
  settings: MemberSettingsOutput;
  currentYear: number;
}

const SettingSummary = (props: SettingSummaryProps) => {
  const { settings, currentYear } = props;
  const styleCds = sortStyleCds(settings.style_cds);

  return (
    <S.Card>
      <S.Row>
        <S.Label>체질</S.Label>
        <S.Value>
          {settings.temperature_sensitivity_cd === null
            ? EMPTY_LABEL
            : getTemperatureSensitivityLabel(
                settings.temperature_sensitivity_cd,
              )}
        </S.Value>
      </S.Row>
      <S.Row>
        <S.Label>연령대</S.Label>
        <S.Value>
          {settings.birth_year === null
            ? EMPTY_LABEL
            : toAgeGroup(settings.birth_year, currentYear)}
        </S.Value>
      </S.Row>
      <S.Row>
        <S.Label>성별</S.Label>
        <S.Value>{getGenderLabel(settings.gender_cd)}</S.Value>
      </S.Row>
      <S.Row $isTopAligned>
        <S.Label>선호 스타일</S.Label>
        {styleCds.length === 0 ? (
          <S.Value>{EMPTY_LABEL}</S.Value>
        ) : (
          <S.Tags>
            {styleCds.map((styleCd) => (
              <Tag key={styleCd} size="sm">
                {getStyleLabel(styleCd)}
              </Tag>
            ))}
          </S.Tags>
        )}
      </S.Row>
    </S.Card>
  );
};

export default SettingSummary;
