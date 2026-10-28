import { useId, useRef, useState } from 'react';
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
  const continueButtonRef = useRef<HTMLButtonElement>(null);
  const registerQuestionId = useId();
  const continueQuestionId = useId();
  const hasAnswered = answer !== null;
  const rejectMessage = photo?.rejectMessage ?? null;

  /*
   * 답한 버튼은 곧바로 꺼지므로, 키보드·화면 읽기 프로그램 사용자가 자리를 잃지 않게 이제 켜진
   * 다음 물음으로 포커스를 옮긴다.
   */
  const answerWith = (nextAnswer: CaptureAnswer) => {
    setAnswer(nextAnswer);
    requestAnimationFrame(() => continueButtonRef.current?.focus());
  };

  const register = () => {
    answerWith('registered');
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
          <S.Question id={registerQuestionId}>이 옷을 등록할까요?</S.Question>
          <S.Choices role="group" aria-labelledby={registerQuestionId}>
            <Button
              variant="outline"
              isFullWidth
              isDisabled={hasAnswered}
              onClick={() => answerWith('discarded')}
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
          {/* 화면 읽기 프로그램이 바뀐 내용을 읽도록 알림 자리는 처음부터 둔다. */}
          <S.AnswerResult role="status">
            {answer === null ? '' : ANSWER_LABEL[answer]}
          </S.AnswerResult>
          <S.Divider />
          <S.Question id={continueQuestionId} $isDimmed={!hasAnswered}>
            촬영을 계속할까요?
          </S.Question>
          <S.Choices role="group" aria-labelledby={continueQuestionId}>
            <Button
              variant="outline"
              isFullWidth
              isDisabled={!hasAnswered}
              onClick={onFinish}
            >
              촬영 종료
            </Button>
            <Button
              ref={continueButtonRef}
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
      <S.Body>
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
      </S.Body>
    </FullScreenDialog>
  );
};

export default CameraCaptureDialog;
