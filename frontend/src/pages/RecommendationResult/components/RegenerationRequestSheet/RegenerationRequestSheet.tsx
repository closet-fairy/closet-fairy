import { useRef, useState } from 'react';
import type { RefObject } from 'react';
import BottomSheet from '@/components/common/BottomSheet';
import Button from '@/components/common/Button';
import SegmentedControl from '@/components/common/SegmentedControl';
import TextArea from '@/components/common/TextArea';
import { REGENERATION_REQUEST_MAX_LENGTH } from '@/domains/recommendation/regeneration';
import type { RegenerationCreate } from '@/generated/models';
import * as S from './RegenerationRequestSheet.styled';

export type RegenerationScope = RegenerationCreate['target_scope_cd'];

interface RegenerationRequestSheetProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  outfitCount: number;
  isSubmitting: boolean;
  errorMessage?: string;
  onTextChange: () => void;
  onSubmit: (text: string, scope: RegenerationScope) => void;
  finalFocus?: RefObject<HTMLElement | null>;
}

const isRegenerationScope = (value: string): value is RegenerationScope =>
  value === 'single' || value === 'all';

const RegenerationRequestSheet = (props: RegenerationRequestSheetProps) => {
  const {
    isOpen,
    onOpenChange,
    outfitCount,
    isSubmitting,
    errorMessage,
    onTextChange,
    onSubmit,
    finalFocus,
  } = props;
  const [text, setText] = useState('');
  const [scope, setScope] = useState<RegenerationScope>('single');
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);

    if (isOpen) {
      setText('');
      setScope('single');
    }
  }

  const handleTextChange = (nextText: string) => {
    setText(nextText);
    onTextChange();
  };

  const handleScopeChange = (nextScope: string) => {
    if (isRegenerationScope(nextScope)) {
      setScope(nextScope);
    }
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title="어떻게 바꿔 드릴까요"
      description="말하듯 적으면 됩니다. 지금 코디는 사라지지 않습니다."
      isDismissable={!isSubmitting}
      initialFocus={inputRef}
      finalFocus={finalFocus}
      footer={
        <Button
          isFullWidth
          isLoading={isSubmitting}
          isDisabled={text.trim().length === 0}
          onClick={() => onSubmit(text, scope)}
        >
          수정 요청하기
        </Button>
      }
    >
      <S.Content>
        {outfitCount > 1 && (
          <SegmentedControl
            variant="separated"
            aria-label="수정할 코디"
            value={scope}
            onChange={handleScopeChange}
            isDisabled={isSubmitting}
            options={[
              { value: 'single', label: '이 세트만' },
              { value: 'all', label: `${outfitCount}세트 전부` },
            ]}
          />
        )}
        <TextArea
          ref={inputRef}
          value={text}
          onChange={handleTextChange}
          maxLength={REGENERATION_REQUEST_MAX_LENGTH}
          errorMessage={errorMessage}
          isDisabled={isSubmitting}
          aria-label="수정 요청 내용"
        />
      </S.Content>
    </BottomSheet>
  );
};

export default RegenerationRequestSheet;
