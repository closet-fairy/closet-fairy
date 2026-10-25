import type { KeyboardEvent } from 'react';
import { useRef, useState } from 'react';
import BottomSheet from '@/components/common/BottomSheet';
import Button from '@/components/common/Button';
import TextField from '@/components/common/TextField';
import {
  CUSTOM_TPO_TEXT_MAX_LENGTH,
  isCustomTpoTextValid,
} from '@/domains/recommendation/customTpoText';

interface CustomTpoSheetProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  initialText: string;
  onSubmit: (text: string) => void;
}

const CustomTpoSheet = (props: CustomTpoSheetProps) => {
  const { isOpen, onOpenChange, initialText, onSubmit } = props;

  const [text, setText] = useState(initialText);
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  const inputRef = useRef<HTMLInputElement | null>(null);

  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);

    if (isOpen) {
      setText(initialText);
    }
  }

  const isValid = isCustomTpoTextValid(text);

  const submit = () => {
    if (!isValid) {
      return;
    }

    onSubmit(text.trim());
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title="어떤 상황인가요"
      description="짧게 적어주시면 그대로 반영합니다."
      initialFocus={inputRef}
      footer={
        <Button isFullWidth isDisabled={!isValid} onClick={submit}>
          이 상황으로 설정
        </Button>
      }
    >
      <TextField
        ref={inputRef}
        value={text}
        onChange={setText}
        placeholder="예: 학교 발표"
        maxLength={CUSTOM_TPO_TEXT_MAX_LENGTH}
        hasClearButton
        onClear={() => setText('')}
        enterKeyHint="done"
        autoComplete="off"
        aria-label="상황"
        onKeyDown={handleKeyDown}
      />
    </BottomSheet>
  );
};

export default CustomTpoSheet;
