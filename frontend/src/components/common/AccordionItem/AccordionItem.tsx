import { useId } from 'react';
import type { ReactNode } from 'react';
import Icon from '@/components/common/Icon';
import * as S from './AccordionItem.styled';

interface AccordionItemProps {
  value: string;
  label: string;
  summary?: ReactNode;
  placeholder: string;
  errorMessage?: string;
  isDisabled?: boolean;
  children: ReactNode;
}

const AccordionItem = (props: AccordionItemProps) => {
  const {
    value,
    label,
    summary,
    placeholder,
    errorMessage,
    isDisabled = false,
    children,
  } = props;
  const errorId = useId();
  const hasSummary =
    summary !== undefined && summary !== null && summary !== '';
  const hasError = errorMessage !== undefined && errorMessage !== '';
  const summaryContent = hasSummary ? summary : placeholder;

  return (
    <S.Item value={value} disabled={isDisabled}>
      <S.Header>
        <S.Trigger aria-describedby={hasError ? errorId : undefined}>
          <S.Label>{label}</S.Label>
          <S.Summary $isEmpty={!hasSummary}>
            {typeof summaryContent === 'string' ? (
              <S.SummaryText>{summaryContent}</S.SummaryText>
            ) : (
              summaryContent
            )}
          </S.Summary>
          <S.Chevron>
            <Icon name="keyboard_arrow_down" size="md" />
          </S.Chevron>
        </S.Trigger>
      </S.Header>
      <S.Panel>
        <S.PanelContent>{children}</S.PanelContent>
      </S.Panel>
      {hasError && (
        <S.ErrorMessage id={errorId} role="alert">
          {errorMessage}
        </S.ErrorMessage>
      )}
    </S.Item>
  );
};

export default AccordionItem;
