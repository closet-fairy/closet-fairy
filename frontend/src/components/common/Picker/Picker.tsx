import type { KeyboardEvent } from 'react';
import { useContext, useId, useState } from 'react';
import BottomSheet from '@/components/common/BottomSheet';
import { FormFieldContext } from '@/components/common/FormField/FormField.context';
import Icon from '@/components/common/Icon';
import * as S from './Picker.styled';

export interface PickerOption {
  value: string;
  label: string;
}

interface PickerProps {
  label: string;
  options: PickerOption[];
  value: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
  isDisabled?: boolean;
  isInvalid?: boolean;
  'aria-describedby'?: string;
}

const findScrollParent = (element: HTMLElement) => {
  let parent = element.parentElement;

  while (parent) {
    const { overflowY } = getComputedStyle(parent);

    if (overflowY === 'auto' || overflowY === 'scroll') {
      return parent;
    }

    parent = parent.parentElement;
  }

  return null;
};

/*
 * scrollIntoView는 시트가 열리는 동안 스크롤이 잠긴 바깥 문서까지 움직일 수 있어서,
 * 가장 가까운 스크롤 부모의 scrollTop만 직접 계산해 선택한 항목을 가운데로 맞춘다.
 */
const scrollToCenter = (element: HTMLElement | null) => {
  if (!element) {
    return;
  }

  const frame = requestAnimationFrame(() => {
    const scrollParent = findScrollParent(element);

    if (!scrollParent) {
      return;
    }

    const parentRect = scrollParent.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();

    scrollParent.scrollTop +=
      elementRect.top -
      parentRect.top -
      (parentRect.height - elementRect.height) / 2;
  });

  return () => cancelAnimationFrame(frame);
};

const getSiblingOption = (option: HTMLElement, key: string) => {
  switch (key) {
    case 'ArrowDown':
      return option.nextElementSibling;
    case 'ArrowUp':
      return option.previousElementSibling;
    case 'Home':
      return option.parentElement?.firstElementChild ?? null;
    case 'End':
      return option.parentElement?.lastElementChild ?? null;
    default:
      return null;
  }
};

const Picker = (props: PickerProps) => {
  const {
    label,
    options,
    value,
    onChange,
    placeholder,
    isDisabled = false,
    isInvalid = false,
    'aria-describedby': ariaDescribedBy,
  } = props;
  const [isOpen, setIsOpen] = useState(false);
  const [activeValue, setActiveValue] = useState<string | null>(null);
  const formField = useContext(FormFieldContext);
  const captionId = useId();
  const displayTextId = useId();

  const selectedOption = options.find((option) => option.value === value);
  const tabbableValue =
    activeValue ?? selectedOption?.value ?? options.at(0)?.value;
  const displayText = selectedOption?.label ?? placeholder;
  const triggerLabelledBy = [
    formField?.labelId,
    captionId,
    displayText ? displayTextId : undefined,
  ]
    .filter((id) => id !== undefined)
    .join(' ');
  const triggerDescribedBy = [formField?.hintId, ariaDescribedBy]
    .filter((id) => id !== undefined)
    .join(' ');

  const handleTriggerClick = () => {
    setActiveValue(null);
    setIsOpen(true);
  };

  const handleSelect = (optionValue: string) => {
    if (optionValue !== value) {
      onChange(optionValue);
    }

    setIsOpen(false);
  };

  const handleOptionKeyDown = (
    event: KeyboardEvent<HTMLLIElement>,
    optionValue: string,
  ) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleSelect(optionValue);
      return;
    }

    const nextOption = getSiblingOption(event.currentTarget, event.key);

    if (nextOption instanceof HTMLElement) {
      event.preventDefault();
      nextOption.focus();
    }
  };

  return (
    <>
      <S.Trigger
        type="button"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-labelledby={triggerLabelledBy}
        aria-describedby={
          triggerDescribedBy === '' ? undefined : triggerDescribedBy
        }
        aria-invalid={isInvalid || undefined}
        disabled={isDisabled}
        onClick={handleTriggerClick}
        $isInvalid={isInvalid}
      >
        <S.Caption id={captionId}>{label}</S.Caption>
        {selectedOption ? (
          <S.Value id={displayTextId}>{selectedOption.label}</S.Value>
        ) : (
          placeholder && (
            <S.Placeholder id={displayTextId}>{placeholder}</S.Placeholder>
          )
        )}
      </S.Trigger>
      <BottomSheet isOpen={isOpen} onOpenChange={setIsOpen} title={label}>
        <S.List role="listbox" aria-label={label}>
          {options.map((option) => {
            const isSelected = option.value === selectedOption?.value;

            return (
              <S.Option
                key={option.value}
                ref={isSelected && isOpen ? scrollToCenter : undefined}
                role="option"
                aria-selected={isSelected}
                tabIndex={option.value === tabbableValue ? 0 : -1}
                $isSelected={isSelected}
                onClick={() => handleSelect(option.value)}
                onKeyDown={(event) => handleOptionKeyDown(event, option.value)}
                onFocus={() => setActiveValue(option.value)}
              >
                <S.OptionLabel>{option.label}</S.OptionLabel>
                {isSelected && <Icon name="check" size="md" />}
              </S.Option>
            );
          })}
        </S.List>
      </BottomSheet>
    </>
  );
};

export default Picker;
