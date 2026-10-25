import { useBlocker } from '@tanstack/react-router';
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import Button from '@/components/common/Button';
import Dialog from '@/components/common/Dialog';
import Icon from '@/components/common/Icon';
import IconButton from '@/components/common/IconButton';
import Stepper from '@/components/common/Stepper';
import TopBar from '@/components/common/TopBar';
import { combineAngle } from '@/domains/clothingImageEdit/angle';
import { BRUSH_SIZE_DEFAULT } from '@/domains/clothingImageEdit/brush';
import type { BrushMode } from '@/domains/clothingImageEdit/brush';
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
import BrushPanel from '@/pages/ClothingImageEditor/components/BrushPanel';
import BrushSurface from '@/pages/ClothingImageEditor/components/BrushSurface';
import { DEFAULT_BRUSH_VIEW } from '@/pages/ClothingImageEditor/components/BrushSurface/brushView';
import type { BrushView } from '@/pages/ClothingImageEditor/components/BrushSurface/brushView';
import EditorCanvas from '@/pages/ClothingImageEditor/components/EditorCanvas';
import PerspectiveOverlay from '@/pages/ClothingImageEditor/components/PerspectiveOverlay';
import RotationPanel from '@/pages/ClothingImageEditor/components/RotationPanel';
import SaveErrorBanner from '@/pages/ClothingImageEditor/components/SaveErrorBanner';
import useBrushStrokes from '@/pages/ClothingImageEditor/hooks/useBrushStrokes';
import useElementSize from '@/pages/ClothingImageEditor/hooks/useElementSize';
import {
  createInitialEditorState,
  getEditState,
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
  isChanged: boolean;
}

export type ImageEditorSaveStatus = 'saved' | 'failed';

interface ImageEditorProps {
  sources: ImageEditorSources;
  initialEdit: InitialEdit;
  isSaving?: boolean;
  saveErrorMessage?: string | null;
  hasUnsavedServerChange?: boolean;
  onSave: (result: ImageEditorSaveResult) => Promise<ImageEditorSaveStatus>;
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
  const {
    sources,
    initialEdit,
    isSaving = false,
    saveErrorMessage = null,
    hasUnsavedServerChange = false,
    onSave,
    onClose,
  } = props;

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
  const [brushMode, setBrushMode] = useState<BrushMode>('erase');
  const [brushSize, setBrushSize] = useState(BRUSH_SIZE_DEFAULT);
  const [isBrushSizeDragging, setIsBrushSizeDragging] = useState(false);
  const [brushView, setBrushView] = useState<BrushView>(DEFAULT_BRUSH_VIEW);
  const [brushViewSize, setBrushViewSize] = useState({ width: 0, height: 0 });
  const [previewCanvas, setPreviewCanvas] = useState<HTMLCanvasElement | null>(
    null,
  );
  const [stageElement, setStageElement] = useState<HTMLDivElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const resetChipRef = useRef<HTMLButtonElement>(null);
  // 버리기를 확정했거나 저장에 성공해 닫을 때는 다시 묻지 않는다.
  const isLeaveAllowedRef = useRef(false);
  const isMountedRef = useRef(true);
  const { ref: viewportRef, size: viewportSize } =
    useElementSize<HTMLDivElement>();

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const isRotationStep = state.step === 'rotation';
  const corners = isRotationStep ? snapCorners(state.corners) : DEFAULT_CORNERS;
  const angle = isRotationStep
    ? getSaveAngle(state)
    : combineAngle(state.quarterTurns, 0);
  const faintOpacity = state.step === 'brush' ? BRUSH_FAINT_OPACITY : 0;
  const brush = useBrushStrokes({
    mask,
    baseMask: sources.initialMask,
    mode: brushMode,
    renderOptions: { corners, angle, faintOpacity },
  });

  const editState = getEditState(state, brush);
  const isChanged = hasChanges(editState, initialState, {
    hasSavedMask: sources.hasSavedMask,
  });
  // 저장이 중간에 실패해 서버가 이미 바뀌었으면, 편집을 되돌렸어도 그냥 나가면 반쯤 저장된 채로 남는다.
  const isLeaveConfirmNeeded = isChanged || hasUnsavedServerChange;
  const shouldBlockLeave = useCallback(
    () => isLeaveConfirmNeeded && !isLeaveAllowedRef.current,
    [isLeaveConfirmNeeded],
  );
  const leaveBlocker = useBlocker({
    shouldBlockFn: shouldBlockLeave,
    enableBeforeUnload: isLeaveConfirmNeeded,
    withResolver: true,
  });
  const isLeaveBlocked = leaveBlocker.status === 'blocked';
  const hasViewport = viewportSize.width > 0 && viewportSize.height > 0;

  // 화면을 돌리는 등 영역 크기가 바뀌면 확대·이동 기준이 달라지므로 화면 맞춤으로 되돌린다.
  if (
    brushViewSize.width !== viewportSize.width ||
    brushViewSize.height !== viewportSize.height
  ) {
    setBrushViewSize(viewportSize);
    setBrushView(DEFAULT_BRUSH_VIEW);
  }

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
    brush.reset(sources.defaultMask);
    setBrushView(DEFAULT_BRUSH_VIEW);
    dispatch({ type: 'reset' });
  };

  const handleResetClick = () => {
    if (!isChanged) {
      resetEditor();
      return;
    }

    setOpenDialog('reset');
  };

  const leave = () => {
    isLeaveAllowedRef.current = true;
    onClose();
  };

  const handleCloseClick = () => {
    if (!isLeaveConfirmNeeded) {
      leave();
      return;
    }

    setOpenDialog('close');
  };

  const handleSave = async () => {
    // 다른 손가락으로 칠하는 중이면 마스크와 표시 이미지가 서로 다른 획을 담게 되므로 저장하지 않는다.
    if (mask === null || brush.isStrokeActive()) {
      return;
    }

    const status = await onSave({ state: editState, mask, isChanged });

    // 저장하는 동안 다른 화면으로 나갔으면 끝난 뒤 다시 옮기지 않는다.
    if (status === 'saved' && isMountedRef.current) {
      leave();
    }
  };

  const handleStepChange = (value: string) => {
    const nextStep = STEPS.find((step) => step.value === value)?.value;

    if (nextStep !== undefined) {
      setBrushView(DEFAULT_BRUSH_VIEW);
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

    if (leaveBlocker.status === 'blocked') {
      isLeaveAllowedRef.current = true;
      leaveBlocker.proceed();
      return;
    }

    leave();
  };

  const handleKeepEditing = () => {
    setOpenDialog(null);

    if (leaveBlocker.status === 'blocked') {
      leaveBlocker.reset();
    }
  };

  const handleLeaveDialogOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      handleKeepEditing();
    }
  };

  const renderPanel = () => {
    switch (state.step) {
      case 'brush':
        return (
          <BrushPanel
            mode={brushMode}
            onModeChange={setBrushMode}
            brushSize={brushSize}
            onBrushSizeChange={setBrushSize}
            onBrushSizeDraggingChange={setIsBrushSizeDragging}
            isUndoAvailable={brush.isUndoAvailable}
            isRedoAvailable={brush.isRedoAvailable}
            onUndo={brush.undo}
            onRedo={brush.redo}
            isRestoreAvailable={sources.isRestoreAvailable}
            isDisabled={isSaving || mask === null}
          />
        );
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
              onClick={() => void handleSave()}
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
      {saveErrorMessage !== null && (
        <SaveErrorBanner
          message={saveErrorMessage}
          isDisabled={isSaving || mask === null}
          onRetry={() => void handleSave()}
        />
      )}
      <S.Stage ref={setStageElement}>
        {/* 단계를 오가도 캔버스가 다시 만들어지지 않도록 브러시 영역은 늘 두고, 브러시 단계에서만 켠다. */}
        <BrushSurface
          targetRef={previewCanvasRef}
          maskSize={sources.size}
          quarterTurns={state.quarterTurns}
          brushSize={brushSize}
          view={brushView}
          onViewChange={setBrushView}
          isActive={state.step === 'brush'}
          isDisabled={isSaving || mask === null}
          isSizePreviewVisible={isBrushSizeDragging}
          onStrokeStart={brush.handleStrokeStart}
          onStrokePoints={brush.handleStrokePoints}
          onStrokeEnd={brush.handleStrokeEnd}
        >
          <S.Viewport ref={viewportRef}>
            {mask !== null && stageErrorMessage === null ? (
              <S.CanvasBox>
                {/* 원근 돋보기가 캔버스를 읽으므로 그린 결과를 남겨 둔다. */}
                <EditorCanvas
                  aria-label="편집 미리보기"
                  base={sources.base}
                  size={sources.size}
                  mask={mask}
                  maskVersion={state.maskVersion}
                  corners={corners}
                  angle={angle}
                  faintOpacity={faintOpacity}
                  displayScale={getDisplayScale()}
                  isDrawingBufferPreserved
                  onReady={(renderer, canvas) => {
                    previewCanvasRef.current = canvas;
                    setPreviewCanvas(canvas);
                    brush.attachRenderer(renderer);
                  }}
                  onError={(error) =>
                    setRenderErrorMessage(getRenderErrorMessage(error))
                  }
                />
                {state.step === 'perspective' && hasViewport && (
                  <PerspectiveOverlay
                    corners={state.corners}
                    quarterTurns={state.quarterTurns}
                    imageSize={sources.size}
                    onChange={(nextCorners) =>
                      dispatch({ type: 'setCorners', corners: nextCorners })
                    }
                    magnifierSource={previewCanvas}
                    magnifierContainer={stageElement}
                    magnifierTop={S.VIEWPORT_TOP}
                    isDisabled={isSaving}
                  />
                )}
              </S.CanvasBox>
            ) : (
              <S.StageMessage role="alert">{stageErrorMessage}</S.StageMessage>
            )}
          </S.Viewport>
        </BrushSurface>
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
        isOpen={openDialog === 'close' || isLeaveBlocked}
        onOpenChange={handleLeaveDialogOpenChange}
        title="편집한 내용을 버릴까요?"
        isDismissable={!isSaving}
        finalFocus={closeButtonRef}
        footer={
          <>
            <Button
              isFullWidth
              isDisabled={isSaving}
              onClick={handleDiscardConfirm}
            >
              버리기
            </Button>
            <Button
              variant="text"
              size="md"
              isFullWidth
              isDisabled={isSaving}
              onClick={handleKeepEditing}
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
