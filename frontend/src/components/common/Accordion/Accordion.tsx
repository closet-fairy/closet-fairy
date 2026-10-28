import type { ReactNode } from 'react';
import * as S from './Accordion.styled';

interface AccordionProps {
  children: ReactNode;
  value?: string | null;
  onValueChange?: (value: string | null) => void;
}

// 한 번에 한 행만 펼치므로 Base UI의 배열 값을 펼친 행 하나(없으면 null)로 바꿔 주고받는다.
const toRootValue = (value: string | null | undefined) => {
  if (value === undefined) {
    return undefined;
  }

  return value === null ? [] : [value];
};

const Accordion = (props: AccordionProps) => {
  const { children, value, onValueChange } = props;

  const handleValueChange = (nextValue: unknown[]) => {
    const openValue = nextValue.at(0);

    onValueChange?.(typeof openValue === 'string' ? openValue : null);
  };

  return (
    <S.Root value={toRootValue(value)} onValueChange={handleValueChange}>
      {children}
    </S.Root>
  );
};

export default Accordion;
