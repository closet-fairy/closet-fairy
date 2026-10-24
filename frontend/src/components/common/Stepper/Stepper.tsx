import Icon from '@/components/common/Icon';
import * as S from './Stepper.styled';

export interface StepperStep {
  value: string;
  label: string;
}

interface StepperProps {
  steps: StepperStep[];
  value: string;
  onChange: (value: string) => void;
  'aria-label': string;
  isDisabled?: boolean;
}

const Stepper = (props: StepperProps) => {
  const {
    steps,
    value,
    onChange,
    'aria-label': ariaLabel,
    isDisabled = false,
  } = props;

  return (
    <S.Nav aria-label={ariaLabel}>
      <S.List $isDisabled={isDisabled}>
        {steps.map((step, index) => {
          const isCurrent = step.value === value;

          const handleClick = () => {
            if (isCurrent) {
              return;
            }

            onChange(step.value);
          };

          return (
            <S.Item key={step.value}>
              {index > 0 && (
                <S.Separator aria-hidden>
                  <Icon name="chevron_right" size="sm" />
                </S.Separator>
              )}
              <S.Step
                type="button"
                aria-current={isCurrent ? 'step' : undefined}
                disabled={isDisabled}
                onClick={handleClick}
                $isCurrent={isCurrent}
              >
                <S.Number aria-hidden $isCurrent={isCurrent}>
                  {index + 1}
                </S.Number>
                <S.Label>{step.label}</S.Label>
              </S.Step>
            </S.Item>
          );
        })}
      </S.List>
    </S.Nav>
  );
};

export default Stepper;
