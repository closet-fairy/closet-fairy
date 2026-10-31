import type { IconName } from '@/assets/icons';
import Icon from '@/components/common/Icon';
import * as S from './HistoryTimeRow.styled';

export type HistoryTimeRowSize = 'md' | 'sm';

interface HistoryTimeRowProps {
  icon: IconName;
  label: string;
  value: string;
  size?: HistoryTimeRowSize;
}

const HistoryTimeRow = (props: HistoryTimeRowProps) => {
  const { icon, label, value, size = 'sm' } = props;

  return (
    <S.Container>
      <S.Lead>
        <Icon name={icon} size={size === 'md' ? 'sm' : 'xs'} />
        <S.Label $size={size}>{label}</S.Label>
      </S.Lead>
      <S.Value $size={size}>{value}</S.Value>
    </S.Container>
  );
};

export default HistoryTimeRow;
