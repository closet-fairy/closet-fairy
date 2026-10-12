import type { IconName } from '@/assets/icons';
import { icons } from '@/assets/icons';
import * as S from './Icon.styled';

export type IconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface IconProps {
  name: IconName;
  size?: IconSize;
  label?: string;
}

const Icon = (props: IconProps) => {
  const { name, size = 'md', label } = props;
  const Svg = icons[name];

  return (
    <S.Container $size={size}>
      {label ? (
        <Svg role="img" aria-label={label} focusable={false} />
      ) : (
        <Svg aria-hidden focusable={false} />
      )}
    </S.Container>
  );
};

export default Icon;
