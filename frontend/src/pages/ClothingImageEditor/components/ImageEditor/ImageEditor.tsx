import { useReducer, useRef, useState } from 'react';
import Button from '@/components/common/Button';
import Dialog from '@/components/common/Dialog';
import Icon from '@/components/common/Icon';
import IconButton from '@/components/common/IconButton';
import Stepper from '@/components/common/Stepper';
import TopBar from '@/components/common/TopBar';
import { combineAngle } from '@/domains/clothingImageEdit/angle';
import {
  getContainScale,
  getDiagonalScale,
} from '@/domains/clothingImageEdit/displayScale';
import {
  DEFAULT_CORNERS,
  getPerspectiveOutputSize,
  snapCorners,
} from '@/domains/clothingImageEdit/perspective';
import { getQuarterTurnedSize } from '@/domains/clothingImageEdit/rotation';
import EditorCanvas from '@/pages/ClothingImageEditor/components/EditorCanvas';
import RotationPanel from '@/pages/ClothingImageEditor/components/RotationPanel';
import useElementSize from '@/pages/ClothingImageEditor/hooks/useElementSize';
import {
  createInitialEditorState,
  getSaveAngle,
  hasChanges,
  imageEditorReducer,
} from '@/pages/ClothingImageEditor/imageEditorState';
import type {
  EditorStep,
  ImageEditorState,
  InitialEdit,
} from '@/pages/ClothingImageEditor/imageEditorState';
import {
  EditorRendererError,
  UNSUPPORTED_MESSAGE,
} from '@/pages/ClothingImageEditor/renderer/createEditorRenderer';
import { cloneCanvas } from '@/pages/ClothingImageEditor/renderer/loadEditorSources';
import type { EditorSources } from '@/pages/ClothingImageEditor/renderer/loadEditorSources';
import * as S from './ImageEditor.styled';

// 바탕은 그리기만 하므로, 스토리처럼 캔버스로 만든 그림도 받을 수 있게 넓혀 둔다.
interface ImageEditorSources extends Omit<EditorSources, 'base'> {
  base: TexImageSource;
}

export interface ImageEditorSaveResult {
  state: ImageEditorState;
  mask: HTMLCanvasElement;
}

interface ImageEditorProps {
  sources: ImageEditorSources;
  initialEdit: InitialEdit;
  isSaving?: boolean;
  onSave: (result: ImageEditorSaveResult) => void;
  onClose: () => void;
}

const STEPS: { value: EditorStep; label: string }[] = [
  { value: 'brush', label: '브러시' },
  { value: 'perspective', label: '원근' },
  { value: 'rotation', label: '회전' },
];

const BRUSH_FAINT_OPACITY = 0.3;

const MASK_ERROR_MESSAGE = '이미지를 처리하지 못했어요.';

type OpenDialog = 'reset' | 'close' | null;

const getRenderErrorMessage = (error: unknown) =>
  error instanceof EditorRendererError ? error.message : UNSUPPORTED_MESSAGE;

const ImageEditor = (props: ImageEditorProps) => {
  const { sources, initialEdit, isSaving = false, onSave, onClose } = props;

  const [initialState] = useState(() =>
    createInitialEditorState(initialEdit, sources.size),
  );
  const [state, dispatch] = useReducer(imageEditorReducer, initialState);
  // 붓질은 이 사본에 하고, 불러온 마스크는 다시 열 때를 위해 그대로 둔다.
  const [mask] = useState(() => {
    try {
      return cloneCanvas(sources.initialMask);
    } catch {
      return null;
    }
  });
  const [openDialog, setOpenDialog] = useState<OpenDialog>(null);
  const [isTiltDragging, setIsTiltDragging] = useState(false);
  const [renderErrorMessage, setRenderErrorMessage] = useState<string | null>(
    null,
  );
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const resetChipRef = useRef<HTMLButtonElement>(null);
  const { ref: viewportRef, size: viewportSize } =
    useElementSize<HTMLDivElement>();

  const isChanged = hasChanges(state, initialState, {
    hasSavedMask: sources.hasSavedMask,
  });
  const isRotationStep = state.step === 'rotation';
  const corners = isRotationStep ? snapCorners(state.corners) : DEFAULT_CORNERS;
  const angle = isRotationStep
    ? getSaveAngle(state)
    : combineAngle(state.quarterTurns, 0);
  const hasViewport = viewportSize.width > 0 && viewportSize.height > 0;

  /*
   * 회전 단계는 대각선 기준 배율이라 각도를 바꿔도 크기가 그대로다.
   * 꼭짓점은 이 단계에서 바뀌지 않으므로, 단계에 있는 동안 배율이 고정된다.
   */
  const getDisplayScale = () => {
    if (!hasViewport) {
      return undefined;
    }

    return isRotationStep
      ? getDiagonalScale(
          viewportSize,
          getPerspectiveOutputSize(corners, sources.size),
        )
      : getContainScale(
          viewportSize,
          getQuarterTurnedSize(sources.size, state.quarterTurns),
        );
  };

  const stageErrorMessage =
    mask === null ? MASK_ERROR_MESSAGE : renderErrorMessage;

  const resetEditor = () => {
    const context = mask?.getContext('2d', { willReadFrequently: true });

    if (mask && context) {
      context.clearRect(0, 0, mask.width, mask.height);
      context.drawImage(sources.defaultMask, 0, 0);
    }

    dispatch({ type: 'reset' });
  };

  const handleResetClick = () => {
    if (!isChanged) {
      resetEditor();
      return;
    }

    setOpenDialog('reset');
  };

  const handleCloseClick = () => {
    if (!isChanged) {
      onClose();
      return;
    }

    setOpenDialog('close');
  };

  const handleStepChange = (value: string) => {
    const nextStep = STEPS.find((step) => step.value === value)?.value;

    if (nextStep !== undefined) {
      dispatch({ type: 'setStep', step: nextStep });
    }
  };

  const handleDialogOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setOpenDialog(null);
    }
  };

  const handleResetConfirm = () => {
    resetEditor();
    setOpenDialog(null);
  };

  const handleDiscardConfirm = () => {
    setOpenDialog(null);
    onClose();
  };

  const renderPanel = () => {
    switch (state.step) {
      case 'brush':
        return <S.PanelBody />;
      case 'perspective':
        return (
          <S.PanelBody>
            <S.Guide>
              펴고 싶은 영역의 네 귀퉁이에 맞춰 주세요.
              <br />
              사각형 바깥은 잘려 나갑니다.
            </S.Guide>
          </S.PanelBody>
        );
      case 'rotation':
        return (
          <RotationPanel
            quarterTurns={state.quarterTurns}
            tilt={state.tilt}
            onQuarterTurn={(direction) =>
              dispatch({ type: 'turnQuarter', direction })
            }
            onTiltChange={(tilt) => dispatch({ type: 'setTilt', tilt })}
            onAngleChange={(nextAngle) =>
              dispatch({ type: 'setAngle', angle: nextAngle })
            }
            onTiltDraggingChange={setIsTiltDragging}
            isDisabled={isSaving}
          />
        );
    }
  };

  return (
    <S.Container>
      <TopBar
        title="이미지 편집"
        leading={
          <IconButton
            ref={closeButtonRef}
            icon="close"
            aria-label="닫기"
            isDisabled={isSaving}
            onClick={handleCloseClick}
          />
        }
        trailing={
          isSaving ? (
            <S.Saving role="status">
              <S.Spinner>
                <Icon name="progress_activity" size="sm" />
              </S.Spinner>
              저장 중…
            </S.Saving>
          ) : (
            <Button
              size="sm"
              isDisabled={mask === null}
              onClick={() => mask && onSave({ state, mask })}
            >
              저장
            </Button>
          )
        }
      />
      <S.StepBand>
        <Stepper
          aria-label="편집 단계"
          steps={STEPS}
          value={state.step}
          onChange={handleStepChange}
          isDisabled={isSaving}
        />
      </S.StepBand>
      <S.Stage>
        <S.Viewport ref={viewportRef}>
          {mask !== null && stageErrorMessage === null ? (
            <EditorCanvas
              aria-label="편집 미리보기"
              base={sources.base}
              size={sources.size}
              mask={mask}
              maskVersion={state.maskVersion}
              corners={corners}
              angle={angle}
              faintOpacity={state.step === 'brush' ? BRUSH_FAINT_OPACITY : 0}
              displayScale={getDisplayScale()}
              onError={(error) =>
                setRenderErrorMessage(getRenderErrorMessage(error))
              }
            />
          ) : (
            <S.StageMessage role="alert">{stageErrorMessage}</S.StageMessage>
          )}
        </S.Viewport>
        {isTiltDragging && <S.Grid aria-hidden />}
        <S.ResetChip
          ref={resetChipRef}
          type="button"
          disabled={isSaving}
          onClick={handleResetClick}
        >
          <S.ChipIcon>
            <Icon name="restart_alt" size="xs" />
          </S.ChipIcon>
          원래대로
        </S.ResetChip>
      </S.Stage>
      <S.Panel>{renderPanel()}</S.Panel>
      <Dialog
        isOpen={openDialog === 'reset'}
        onOpenChange={handleDialogOpenChange}
        title="편집 전으로 되돌릴까요?"
        description="브러시·원근·회전이 모두 처음 상태로 돌아가며, 실행 취소할 수 없어요."
        finalFocus={resetChipRef}
        footer={
          <>
            <Button isFullWidth onClick={handleResetConfirm}>
              되돌리기
            </Button>
            <Button
              variant="text"
              size="md"
              isFullWidth
              onClick={() => setOpenDialog(null)}
            >
              취소
            </Button>
          </>
        }
      />
      <Dialog
        isOpen={openDialog === 'close'}
        onOpenChange={handleDialogOpenChange}
        title="편집한 내용을 버릴까요?"
        finalFocus={closeButtonRef}
        footer={
          <>
            <Button isFullWidth onClick={handleDiscardConfirm}>
              버리기
            </Button>
            <Button
              variant="text"
              size="md"
              isFullWidth
              onClick={() => setOpenDialog(null)}
            >
              계속 편집
            </Button>
          </>
        }
      />
    </S.Container>
  );
};

export default ImageEditor;
