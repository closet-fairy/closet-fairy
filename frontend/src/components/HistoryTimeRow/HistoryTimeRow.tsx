import type { IconName } from '@/assets/icons';
import Icon from '@/components/common/Icon';
import * as S from './HistoryTimeRow.styled';

interface HistoryTimeRowProps {
  icon: IconName;
  label: string;
  value: string;
}

const HistoryTimeRow = (props: HistoryTimeRowProps) => {
  const { icon, label, value } = props;

  return (
    <S.Container>
      <S.Lead>
        <Icon name={icon} size="xs" />
        <S.Label>{label}</S.Label>
      </S.Lead>
      <S.Value>{value}</S.Value>
    </S.Container>
  );
};

export default HistoryTimeRow;
