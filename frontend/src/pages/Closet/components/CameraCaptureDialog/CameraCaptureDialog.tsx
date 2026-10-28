import { useState } from 'react';
import Button from '@/components/common/Button';
import FullScreenDialog from '@/components/common/FullScreenDialog';
import Icon from '@/components/common/Icon';
import type { PickedPhoto } from '@/pages/Closet/types';
import * as S from './CameraCaptureDialog.styled';

type CaptureAnswer = 'registered' | 'discarded';

interface CameraCaptureDialogProps {
  isOpen: boolean;
  photo: PickedPhoto | null;
  onRegister: () => void;
  onContinue: () => void;
  onFinish: () => void;
}

const ANSWER_LABEL: Record<CaptureAnswer, string> = {
  registered: '등록했어요',
  discarded: '버렸어요',
};

// 사진마다 답을 새로 받으므로, 받는 쪽은 새 사진이 올 때 key를 바꿔 다시 그린다.
const CameraCaptureDialog = (props: CameraCaptureDialogProps) => {
  const { isOpen, photo, onRegister, onContinue, onFinish } = props;
  const [answer, setAnswer] = useState<CaptureAnswer | null>(null);
  const [isPreviewBroken, setIsPreviewBroken] = useState(false);
  const hasAnswered = answer !== null;
  const rejectMessage = photo?.rejectMessage ?? null;

  const register = () => {
    setAnswer('registered');
    onRegister();
  };

  return (
    <FullScreenDialog
      isOpen={isOpen}
      onOpenChange={(nextIsOpen) => {
        if (!nextIsOpen) {
          onFinish();
        }
      }}
      title="옷 촬영"
      closeButton="close"
      footer={
        <S.Answers>
          <S.Question>이 옷을 등록할까요?</S.Question>
          <S.Choices>
            <Button
              variant="outline"
              isFullWidth
              isDisabled={hasAnswered}
              onClick={() => setAnswer('discarded')}
            >
              버리기
            </Button>
            <Button
              isFullWidth
              isDisabled={hasAnswered || rejectMessage !== null}
              onClick={register}
            >
              등록
            </Button>
          </S.Choices>
          {answer !== null && (
            <S.AnswerResult role="status">
              {ANSWER_LABEL[answer]}
            </S.AnswerResult>
          )}
          <S.Divider />
          <S.Question $isDimmed={!hasAnswered}>촬영을 계속할까요?</S.Question>
          <S.Choices>
            <Button
              variant="outline"
              isFullWidth
              isDisabled={!hasAnswered}
              onClick={onFinish}
            >
              촬영 종료
            </Button>
            <Button
              variant="outline"
              isFullWidth
              isDisabled={!hasAnswered}
              onClick={onContinue}
            >
              계속 촬영
            </Button>
          </S.Choices>
        </S.Answers>
      }
    >
      <S.Preview>
        {photo !== null &&
          (isPreviewBroken ? (
            <S.Placeholder>
              <Icon name="image" size="xl" />
              <S.FileName>{photo.file.name}</S.FileName>
            </S.Placeholder>
          ) : (
            <S.Image
              src={photo.previewUrl}
              alt="촬영한 옷"
              onError={() => setIsPreviewBroken(true)}
            />
          ))}
      </S.Preview>
      {rejectMessage !== null && (
        <S.RejectMessage role="alert">{rejectMessage}</S.RejectMessage>
      )}
    </FullScreenDialog>
  );
};

export default CameraCaptureDialog;
