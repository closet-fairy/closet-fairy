import { useEffect, useRef, useState } from 'react';
import type { FocusEvent, KeyboardEvent } from 'react';
import Button from '@/components/common/Button';
import Icon from '@/components/common/Icon';
import IconButton from '@/components/common/IconButton';
import Slider from '@/components/common/Slider';
import TextField from '@/components/common/TextField';
import {
  combineAngle,
  formatAngleInput,
  normalizeAngle,
  parseAngleInput,
  TILT_LIMIT,
} from '@/domains/clothingImageEdit/angle';
import * as S from './RotationPanel.styled';

interface RotationPanelProps {
  quarterTurns: number;
  tilt: number;
  onQuarterTurn: (direction: 1 | -1) => void;
  onTiltChange: (tilt: number) => void;
  onAngleChange: (angle: number) => void;
  onTiltDraggingChange?: (isDragging: boolean) => void;
  isDisabled?: boolean;
}

const TILT_MARKS = [
  { value: -TILT_LIMIT, label: `−${TILT_LIMIT}°` },
  { value: 0, label: '0°' },
  { value: TILT_LIMIT, label: `${TILT_LIMIT}°` },
];

// 손가락으로 끄는 중에는 0° 눈금을 정확히 맞추기 어려워, 이 범위 안이면 0°에 붙인다.
const ZERO_SNAP_RANGE = 1;

const formatAngleLabel = (angle: number) =>
  `${formatAngleInput(angle).replace('-', '−')}°`;

const getTiltValueText = (value: number) => `${value}도`;

const toggleSign = (text: string) =>
  text.startsWith('-') ? text.slice(1) : `-${text.replace(/^\+/, '')}`;

const RotationPanel = (props: RotationPanelProps) => {
  const {
    quarterTurns,
    tilt,
    onQuarterTurn,
    onTiltChange,
    onAngleChange,
    onTiltDraggingChange,
    isDisabled = false,
  } = props;

  const [isEditing, setIsEditing] = useState(false);
  const [inputText, setInputText] = useState('');
  const valueButtonRef = useRef<HTMLButtonElement>(null);
  const shouldRestoreFocusRef = useRef(false);
  // 누르는 순간의 값 변경도 끄는 중으로 봐야 해서, 다시 그리기를 기다리지 않는 ref로 든다.
  const isDraggingRef = useRef(false);
  const angle = combineAngle(quarterTurns, tilt);

  useEffect(() => {
    if (!isEditing && shouldRestoreFocusRef.current) {
      shouldRestoreFocusRef.current = false;
      valueButtonRef.current?.focus();
    }
  }, [isEditing]);

  const startEditing = () => {
    setInputText(formatAngleInput(angle));
    setIsEditing(true);
  };

  const applyInput = (text: string) => {
    setInputText(text);
    const parsed = parseAngleInput(text);

    if (parsed !== null) {
      onAngleChange(normalizeAngle(parsed));
    }
  };

  /*
   * 입력하는 동안 이미 마지막 유효값을 반영했으므로 확정할 때 다시 보내지 않는다.
   * 다시 보내면 입력칸을 벗어나며 누른 슬라이더 값을 입력칸 글자로 덮어쓴다.
   */
  const commitInput = () => {
    setIsEditing(false);
  };

  const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter' || event.nativeEvent.isComposing) {
      return;
    }

    event.preventDefault();
    shouldRestoreFocusRef.current = true;
    commitInput();
  };

  // 부호 버튼으로 포커스가 옮겨 가는 것은 입력 중이므로, 입력 영역 밖으로 나갈 때만 확정한다.
  const handleInputRowBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (!isEditing || event.currentTarget.contains(event.relatedTarget)) {
      return;
    }

    commitInput();
  };

  const handleDraggingChange = (nextIsDragging: boolean) => {
    isDraggingRef.current = nextIsDragging;
    onTiltDraggingChange?.(nextIsDragging);
  };

  const handleTiltChange = (value: number) => {
    onTiltChange(
      isDraggingRef.current && Math.abs(value) <= ZERO_SNAP_RANGE ? 0 : value,
    );
  };

  return (
    <S.Container>
      {isEditing ? (
        <S.InputRow onBlur={handleInputRowBlur}>
          <S.SignButtonSlot onMouseDown={(event) => event.preventDefault()}>
            <IconButton
              icon="exposure"
              aria-label="부호 바꾸기"
              isDisabled={isDisabled}
              onClick={() => applyInput(toggleSign(inputText))}
            />
          </S.SignButtonSlot>
          <S.Field>
            <TextField
              type="text"
              inputMode="decimal"
              enterKeyHint="done"
              autoComplete="off"
              autoFocus
              aria-label="회전 각도"
              value={inputText}
              onChange={applyInput}
              onKeyDown={handleInputKeyDown}
              isDisabled={isDisabled}
            />
          </S.Field>
          <S.Unit aria-hidden>°</S.Unit>
        </S.InputRow>
      ) : (
        <S.ButtonRow>
          <Button
            variant="outline"
            size="md"
            icon="rotate_left"
            aria-label="왼쪽으로 90° 돌리기"
            isDisabled={isDisabled}
            onClick={() => onQuarterTurn(-1)}
          >
            90°
          </Button>
          <S.ValueButton
            ref={valueButtonRef}
            type="button"
            aria-label={`각도 ${formatAngleLabel(angle)}, 직접 입력`}
            disabled={isDisabled}
            onClick={startEditing}
          >
            {formatAngleLabel(angle)}
            <S.ValueIcon>
              <Icon name="edit" size="xs" />
            </S.ValueIcon>
          </S.ValueButton>
          <Button
            variant="outline"
            size="md"
            icon="rotate_right"
            aria-label="오른쪽으로 90° 돌리기"
            isDisabled={isDisabled}
            onClick={() => onQuarterTurn(1)}
          >
            90°
          </Button>
        </S.ButtonRow>
      )}
      <Slider
        aria-label="기울기"
        value={tilt}
        onChange={handleTiltChange}
        min={-TILT_LIMIT}
        max={TILT_LIMIT}
        step={1}
        fillOrigin={0}
        marks={TILT_MARKS}
        getAriaValueText={getTiltValueText}
        onDraggingChange={handleDraggingChange}
        isDisabled={isDisabled}
      />
    </S.Container>
  );
};

export default RotationPanel;
