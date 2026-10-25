import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import Button from '@/components/common/Button';
import Icon from '@/components/common/Icon';
import IconButton from '@/components/common/IconButton';
import Tag from '@/components/common/Tag';
import TopBar from '@/components/common/TopBar';
import * as S from './OnboardingStepLayout.styled';

interface OnboardingStepLayoutProps {
  step: number;
  totalSteps: number;
  title: string;
  description: string;
  note?: string;
  isOptional?: boolean;
  hasDivider?: boolean;
  children: ReactNode;
  errorMessage?: string;
  canContinue: boolean;
  isSaving?: boolean;
  onContinue: () => void;
  onBack?: () => void;
  onLogout: () => void;
}

const OnboardingStepLayout = (props: OnboardingStepLayoutProps) => {
  const {
    step,
    totalSteps,
    title,
    description,
    note,
    isOptional = false,
    hasDivider = false,
    children,
    errorMessage,
    canContinue,
    isSaving = false,
    onContinue,
    onBack,
    onLogout,
  } = props;
  const titleRef = useRef<HTMLHeadingElement>(null);
  const previousStepRef = useRef(step);

  useEffect(() => {
    if (previousStepRef.current !== step) {
      previousStepRef.current = step;
      titleRef.current?.focus();
    }
  }, [step]);

  return (
    <S.Container>
      <TopBar
        leading={
          onBack && (
            <IconButton
              icon="arrow_back"
              aria-label="이전 단계"
              isDisabled={isSaving}
              onClick={onBack}
            />
          )
        }
        trailing={
          <Button
            variant="text"
            size="md"
            isDisabled={isSaving}
            onClick={onLogout}
          >
            로그아웃
          </Button>
        }
      />
      <S.Header>
        {isOptional && (
          <S.Badge>
            <Tag size="sm">선택</Tag>
          </S.Badge>
        )}
        <S.Title ref={titleRef} tabIndex={-1}>
          {title}
        </S.Title>
        <S.Description>
          {description}
          {note && (
            <>
              <br />
              {note}
            </>
          )}
        </S.Description>
      </S.Header>
      <S.Body>{children}</S.Body>
      {errorMessage && (
        <S.ErrorMessage role="alert">
          <Icon name="error" size="sm" />
          {errorMessage}
        </S.ErrorMessage>
      )}
      <S.Footer $hasDivider={hasDivider}>
        <S.Progress
          role="progressbar"
          aria-label="온보딩 진행"
          aria-valuemin={1}
          aria-valuemax={totalSteps}
          aria-valuenow={step}
          aria-valuetext={`${totalSteps}단계 중 ${step}단계`}
        >
          <S.ProgressFill style={{ width: `${(step / totalSteps) * 100}%` }} />
        </S.Progress>
        <S.ContinueButton>
          <Button
            size="md"
            isFullWidth
            isDisabled={!canContinue}
            isLoading={isSaving}
            onClick={onContinue}
          >
            계속
          </Button>
        </S.ContinueButton>
      </S.Footer>
    </S.Container>
  );
};

export default OnboardingStepLayout;
