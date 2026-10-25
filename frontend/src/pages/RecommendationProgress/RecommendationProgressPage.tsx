import type { ShouldBlockFn } from '@tanstack/react-router';
import {
  useBlocker,
  useNavigate,
  useParams,
  useRouter,
} from '@tanstack/react-router';
import {
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from 'react';
import { ApiError } from '@/apis/apiError';
import { isUnauthorizedError } from '@/apis/authSession';
import Button from '@/components/common/Button';
import Dialog from '@/components/common/Dialog';
import StatusView from '@/components/common/StatusView';
import {
  PENDING_RECOMMENDATION_STORAGE_KEY,
  RECOMMENDATION_FORM_DRAFT_STORAGE_KEY,
} from '@/constants/recommendationStorageKey';
import type { RecommendationProgress } from '@/domains/recommendation/recommendationProgress';
import { getRecommendationProgress } from '@/domains/recommendation/recommendationProgress';
import { parsePendingRecommendation } from '@/domains/recommendation/recommendationRequestRecord';
import {
  useCancelRecommendationSessionRecommendationSessionsRecommendationSessionIdCancelPost,
  useGetRecommendationResultRecommendationSessionsRecommendationSessionIdGet,
} from '@/generated/endpoints/recommendation/recommendation';
import {
  readSessionJson,
  removeSessionItem,
  writeSessionJson,
} from '@/utils/sessionStorageJson';
import * as S from './RecommendationProgressPage.styled';

type LeaveState = 'none' | 'canceling' | 'leaving';

const POLLING_INTERVAL_MS = 2000;
const MIN_DISPLAY_MS = 1000;
const CANCEL_BUTTON_DELAY_MS = 1000;
const URL_RESTORE_TIMEOUT_MS = 1000;
const NOT_FOUND_STATUS = 404;
const INPUT_PATH = '/recommendation';

const progressVisual = (
  <svg width={190} height={190} viewBox="0 0 190 190" aria-hidden>
    <circle
      cx={95}
      cy={95}
      r={94}
      fill="none"
      stroke="currentColor"
      strokeDasharray="4 4"
    />
  </svg>
);

/*
 * 뒤로 가기를 막으면 브라우저가 이미 바꾼 주소를 history.go로 되돌리는데, 이 이동은 비동기다.
 * 되돌리기가 끝나기 전에 다른 화면으로 replace하면 진행 화면 대신 입력 화면 기록이 바뀌어 버린다.
 */
const waitForPopState = () =>
  new Promise<void>((resolve) => {
    const handleDone = () => {
      clearTimeout(timer);
      window.removeEventListener('popstate', handleDone);
      resolve();
    };
    const timer = setTimeout(handleDone, URL_RESTORE_TIMEOUT_MS);

    window.addEventListener('popstate', handleDone);
  });

const RecommendationProgressPage = () => {
  const { sessionId } = useParams({
    from: '/recommendation_/sessions/$sessionId',
  });
  const navigate = useNavigate();
  const router = useRouter();
  const [pending] = useState(() =>
    parsePendingRecommendation(
      readSessionJson(PENDING_RECOMMENDATION_STORAGE_KEY),
      sessionId,
    ),
  );
  const [leaveState, setLeaveState] = useState<LeaveState>('none');
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [isCancelButtonVisible, setIsCancelButtonVisible] = useState(false);
  const isLeaveAllowedRef = useRef(false);
  const cancelButtonRef = useRef<HTMLButtonElement | null>(null);
  const { mutateAsync: cancelSession } =
    useCancelRecommendationSessionRecommendationSessionsRecommendationSessionIdCancelPost();
  const {
    data: result,
    error,
    refetch,
  } = useGetRecommendationResultRecommendationSessionsRecommendationSessionIdGet(
    sessionId,
    {
      query: {
        refetchInterval: (query) => {
          const { data, status } = query.state;

          if (data === undefined) {
            return status === 'error' ? false : POLLING_INTERVAL_MS;
          }

          return getRecommendationProgress(data) === 'processing'
            ? POLLING_INTERVAL_MS
            : false;
        },
      },
    },
  );
  const progress =
    result === undefined ? null : getRecommendationProgress(result);
  const isCanceling = leaveState === 'canceling';
  // 결과가 나와도 최소 노출 시간이 지나 이동하기 전까지는 기다리는 중으로 본다.
  const isWaiting =
    leaveState === 'none' &&
    (progress === null ? error === null : progress !== 'ended');
  const shouldBlockLeave = useCallback<ShouldBlockFn>(
    ({ current, next }) =>
      !isLeaveAllowedRef.current &&
      current.pathname !== next.pathname &&
      (isCanceling || isWaiting),
    [isCanceling, isWaiting],
  );
  const leaveBlocker = useBlocker({
    shouldBlockFn: shouldBlockLeave,
    enableBeforeUnload: false,
    withResolver: true,
  });
  // 취소 요청을 기다린 뒤에는 그사이 바뀐 차단 상태를 읽어야 하므로 최신 값을 ref로 둔다.
  const leaveBlockerRef = useRef(leaveBlocker);
  const isLeaveBlocked = leaveBlocker.status === 'blocked';

  useEffect(() => {
    leaveBlockerRef.current = leaveBlocker;
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsCancelButtonVisible(true);
    }, CANCEL_BUTTON_DELAY_MS);

    return () => {
      clearTimeout(timer);
    };
  }, []);

  // 확인 창이 떠 있는 동안 앞으로 가기로 진행 화면에 돌아오면 나가려던 것을 거둔 것으로 본다.
  useEffect(() => {
    if (!isLeaveBlocked) {
      return;
    }

    const handlePopState = () => {
      const blocker = leaveBlockerRef.current;

      if (
        blocker.status === 'blocked' &&
        window.location.pathname === blocker.current.pathname
      ) {
        blocker.proceed();
      }
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [isLeaveBlocked]);

  const returnToInput = () => {
    isLeaveAllowedRef.current = true;
    removeSessionItem(PENDING_RECOMMENDATION_STORAGE_KEY);
    const blocker = leaveBlockerRef.current;

    if (blocker.status === 'blocked') {
      // 여러 칸 뒤로 가는 등 입력 화면이 아닌 곳으로 나가면 입력값을 남기지 않는다.
      if (pending && blocker.next.pathname === INPUT_PATH) {
        writeSessionJson(RECOMMENDATION_FORM_DRAFT_STORAGE_KEY, pending.form);
      }

      blocker.proceed();
      return;
    }

    if (pending) {
      writeSessionJson(RECOMMENDATION_FORM_DRAFT_STORAGE_KEY, pending.form);
    }

    if (pending && router.history.canGoBack()) {
      router.history.back();
      return;
    }

    void navigate({ to: INPUT_PATH, replace: true });
  };

  const cancelAndReturn = async () => {
    setLeaveState('canceling');

    try {
      await cancelSession({ recommendationSessionId: sessionId });
    } catch {
      // 취소 요청이 실패해도 남은 세션은 BE의 이탈 정리가 닫는다.
    }

    setIsCancelDialogOpen(false);
    returnToInput();
  };

  const moveToResult = async () => {
    isLeaveAllowedRef.current = true;
    removeSessionItem(PENDING_RECOMMENDATION_STORAGE_KEY);
    setIsCancelDialogOpen(false);
    const blocker = leaveBlockerRef.current;

    if (blocker.status === 'blocked') {
      const urlRestored = waitForPopState();
      blocker.reset();
      await urlRestored;
    }

    await navigate({
      to: '/recommendation/sessions/$sessionId/result',
      params: { sessionId: String(sessionId) },
      replace: true,
    });
  };

  const settle = useEffectEvent(
    (settledProgress: Exclude<RecommendationProgress, 'processing'>) => {
      if (settledProgress === 'completed') {
        setLeaveState('leaving');
        void moveToResult();
        return;
      }

      if (settledProgress === 'failed') {
        void cancelAndReturn();
        return;
      }

      setLeaveState('leaving');
      returnToInput();
    },
  );

  useEffect(() => {
    if (leaveState !== 'none' || progress === null) {
      return;
    }

    if (progress === 'processing') {
      return;
    }

    const delay =
      pending === null
        ? 0
        : Math.max(0, pending.requestedAt + MIN_DISPLAY_MS - Date.now());
    const timer = setTimeout(() => {
      settle(progress);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [leaveState, pending, progress]);

  const handleKeepWaiting = () => {
    setIsCancelDialogOpen(false);

    if (leaveBlocker.status === 'blocked') {
      leaveBlocker.reset();
    }
  };

  const handleCancelDialogOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      handleKeepWaiting();
    }
  };

  const cancelDialog = (
    <Dialog
      isOpen={isCancelDialogOpen || isLeaveBlocked}
      onOpenChange={handleCancelDialogOpenChange}
      title="추천을 그만둘까요?"
      description="지금 그만두면 만들던 코디는 사라져요."
      isDismissable={!isCanceling}
      finalFocus={cancelButtonRef}
      footer={
        <>
          <Button
            isFullWidth
            isLoading={isCanceling}
            onClick={() => void cancelAndReturn()}
          >
            그만두기
          </Button>
          <Button
            variant="text"
            size="md"
            isFullWidth
            isDisabled={isCanceling}
            onClick={handleKeepWaiting}
          >
            계속 기다리기
          </Button>
        </>
      }
    />
  );

  if (result === undefined && error !== null) {
    const isNotFound =
      error instanceof ApiError && error.status === NOT_FOUND_STATUS;

    return (
      <>
        <StatusView
          title="추천 상태를 확인하지 못했어요"
          description={isUnauthorizedError(error) ? undefined : error.message}
          actions={
            <>
              {!isNotFound && (
                <Button isFullWidth onClick={() => void refetch()}>
                  다시 시도
                </Button>
              )}
              <Button
                variant={isNotFound ? 'primary' : 'text'}
                size={isNotFound ? 'lg' : 'md'}
                isFullWidth
                onClick={returnToInput}
              >
                돌아가기
              </Button>
            </>
          }
        />
        {cancelDialog}
      </>
    );
  }

  return (
    <>
      <StatusView
        visual={progressVisual}
        visualPlacement="bottom"
        title="코디를 만들고 있어요"
        description="잠시만 기다려 주세요..."
        actions={
          <S.CancelAction $isVisible={isCancelButtonVisible}>
            <Button
              ref={cancelButtonRef}
              variant="text"
              size="md"
              isFullWidth
              isDisabled={leaveState !== 'none'}
              onClick={() => setIsCancelDialogOpen(true)}
            >
              추천 그만두기
            </Button>
          </S.CancelAction>
        }
      />
      {cancelDialog}
    </>
  );
};

export default RecommendationProgressPage;
