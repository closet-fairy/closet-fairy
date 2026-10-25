import IconButton from '@/components/common/IconButton';
import Notice from '@/components/common/Notice';
import SegmentedControl from '@/components/common/SegmentedControl';
import type { SegmentedControlOption } from '@/components/common/SegmentedControl/SegmentedControl';
import Slider from '@/components/common/Slider';
import {
  BRUSH_SIZE_MAX,
  BRUSH_SIZE_MIN,
} from '@/domains/clothingImageEdit/brush';
import type { BrushMode } from '@/domains/clothingImageEdit/brush';
import * as S from './BrushPanel.styled';

interface BrushPanelProps {
  mode: BrushMode;
  onModeChange: (mode: BrushMode) => void;
  brushSize: number;
  onBrushSizeChange: (size: number) => void;
  onBrushSizeDraggingChange?: (isDragging: boolean) => void;
  isUndoAvailable: boolean;
  isRedoAvailable: boolean;
  onUndo: () => void;
  onRedo: () => void;
  isRestoreAvailable?: boolean;
  isDisabled?: boolean;
}

const MODE_OPTIONS = [
  { value: 'erase', label: '지우기', icon: 'ink_eraser' },
  { value: 'restore', label: '되살리기', icon: 'brush' },
] as const satisfies readonly (SegmentedControlOption & {
  value: BrushMode;
})[];

const getBrushSizeText = (size: number) => `${size}픽셀`;

const BrushPanel = (props: BrushPanelProps) => {
  const {
    mode,
    onModeChange,
    brushSize,
    onBrushSizeChange,
    onBrushSizeDraggingChange,
    isUndoAvailable,
    isRedoAvailable,
    onUndo,
    onRedo,
    isRestoreAvailable = true,
    isDisabled = false,
  } = props;

  const handleModeChange = (value: string) => {
    const nextMode = MODE_OPTIONS.find((option) => option.value === value);

    if (nextMode !== undefined) {
      onModeChange(nextMode.value);
    }
  };

  return (
    <S.Container>
      {!isRestoreAvailable && (
        <Notice
          variant="subtle"
          icon="info"
          title="원본을 불러오지 못해 되살리기를 쓸 수 없어요."
        />
      )}
      <S.ToolRow>
        <S.ModeControl>
          <SegmentedControl
            aria-label="브러시 모드"
            options={[...MODE_OPTIONS]}
            value={mode}
            onChange={handleModeChange}
            isDisabled={isDisabled || !isRestoreAvailable}
          />
        </S.ModeControl>
        <IconButton
          icon="undo"
          aria-label="실행 취소"
          aria-keyshortcuts="Control+Z Meta+Z"
          isDisabled={isDisabled || !isUndoAvailable}
          onClick={onUndo}
        />
        <IconButton
          icon="redo"
          aria-label="다시 실행"
          aria-keyshortcuts="Control+Shift+Z Meta+Shift+Z Control+Y"
          isDisabled={isDisabled || !isRedoAvailable}
          onClick={onRedo}
        />
      </S.ToolRow>
      <S.SizeRow>
        <S.SizeLabel aria-hidden>붓</S.SizeLabel>
        <S.SmallDot aria-hidden />
        <S.SliderSlot>
          <Slider
            aria-label="붓 크기"
            value={brushSize}
            onChange={onBrushSizeChange}
            min={BRUSH_SIZE_MIN}
            max={BRUSH_SIZE_MAX}
            step={1}
            getAriaValueText={getBrushSizeText}
            onDraggingChange={onBrushSizeDraggingChange}
            isDisabled={isDisabled}
          />
        </S.SliderSlot>
        <S.LargeDot aria-hidden />
        <S.SizeValue aria-hidden>{brushSize}px</S.SizeValue>
      </S.SizeRow>
    </S.Container>
  );
};

export default BrushPanel;
