import { replaceEqualDeep, useQueryClient } from '@tanstack/react-query';
import { useBlocker, useNavigate, useParams } from '@tanstack/react-router';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { ApiError, isClientError } from '@/apis/apiError';
import { isUnauthorizedError } from '@/apis/authSession';
import Button from '@/components/common/Button';
import Carousel from '@/components/common/Carousel';
import Dialog from '@/components/common/Dialog';
import Icon from '@/components/common/Icon';
import IconButton from '@/components/common/IconButton';
import StatusView from '@/components/common/StatusView';
import {
  setToastBottomOffset,
  showToast,
} from '@/components/common/ToastProvider/ToastProvider.toast';
import TopBar from '@/components/common/TopBar';
import OutfitLoading from '@/components/OutfitLoading';
import { REGENERATION_FAILURE_NOTICE_STORAGE_KEY } from '@/constants/recommendationStorageKey';
import { getOutfitLayers } from '@/domains/recommendation/outfitLayers';
import {
  canViewRecommendationResult,
  getRecommendationProgress,
  keepViewedOutfits,
} from '@/domains/recommendation/recommendationProgress';
import {
  findRegeneratedOutfitIndex,
  isOutfitRegenerating,
  isRegenerationFailureNoticed,
  isRegenerationProcessing,
} from '@/domains/recommendation/regeneration';
import {
  getGetRecommendationHistoryDetailRecommendationHistoryRecommendationSessionIdGetQueryOptions,
  getGetRecommendationResultRecommendationSessionsRecommendationSessionIdGetQueryKey,
  useCancelRecommendationSessionRecommendationSessionsRecommendationSessionIdCancelPost,
  useGetRecommendationResultRecommendationSessionsRecommendationSessionIdGet,
  useRateRecommendationRecommendationSessionsRecommendationSessionIdRatingPost,
  useRequestRegenerationRecommendationSessionsRecommendationSessionIdRegenerationsPost,
} from '@/generated/endpoints/recommendation/recommendation';
import type { OutfitResult, RecommendationResult } from '@/generated/models';
import { readSessionJson, writeSessionJson } from '@/utils/sessionStorageJson';
import waitForPopState from '@/utils/waitForPopState';
import OutfitActions from './components/OutfitActions';
import { OUTFIT_ACTIONS_HEIGHT } from './components/OutfitActions/OutfitActions.styled';
import OutfitInfoSheet from './components/OutfitInfoSheet';
import OutfitStack from './components/OutfitStack';
import RatingDialog from './components/RatingDialog';
import RegenerationRequestSheet from './components/RegenerationRequestSheet';
import type { RegenerationScope } from './components/RegenerationRequestSheet/RegenerationRequestSheet';
import * as S from './RecommendationResultPage.styled';

type OpenLayer = 'info' | 'rating' | 'request' | null;
type SessionRejection = 'expired' | 'unavailable' | null;
type LeaveTarget = 'input' | 'clothingRegister';

interface ViewedHistory {
  latestOutfitId: number;
  depth: number;
}

const NOT_FOUND_STATUS = 404;
const REGENERATION_POLLING_INTERVAL_MS = 2000;
const SESSION_NOT_FOUND_CODE = 'SESSION_NOT_FOUND';
const SESSION_ALREADY_SETTLED_CODE = 'SESSION_ALREADY_SETTLED';
// 취소나 이탈로 이미 끝난 세션에 별점을 보냈을 때 내려오는 코드다.
const SESSION_NOT_RATABLE_CODE = 'SESSION_NOT_RATABLE';
const SESSION_ENDED_CODE = 'SESSION_ENDED';

const hasOutfitList = (
  value: unknown,
): value is Pick<RecommendationResult, 'outfits'> =>
  typeof value === 'object' &&
  value !== null &&
  'outfits' in value &&
  Array.isArray(value.outfits);

const shareResult = (previous: unknown, next: unknown) =>
  hasOutfitList(previous) && hasOutfitList(next)
    ? replaceEqualDeep(previous, keepViewedOutfits(previous, next))
    : next;

const RecommendationResultPage = () => {
  const { sessionId } = useParams({
    from: '/recommendation_/sessions/$sessionId_/result',
  });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const {
    data: result,
    error,
    isFetching,
    refetch,
  } = useGetRecommendationResultRecommendationSessionsRecommendationSessionIdGet(
    sessionId,
    {
      query: {
        structuralSharing: shareResult,
        refetchInterval: (query) =>
          isRegenerationProcessing(
            query.state.data?.latest_regeneration ?? null,
          )
            ? REGENERATION_POLLING_INTERVAL_MS
            : false,
      },
    },
  );
  const { mutateAsync: cancelSession } =
    useCancelRecommendationSessionRecommendationSessionsRecommendationSessionIdCancelPost();
  const { mutate: rateOutfit, isPending: isRatingPending } =
    useRateRecommendationRecommendationSessionsRecommendationSessionIdRatingPost();
  const {
    mutate: requestRegeneration,
    reset: resetRegenerationRequest,
    error: regenerationRequestError,
    isPending: isRequestingRegeneration,
  } = useRequestRegenerationRecommendationSessionsRecommendationSessionIdRegenerationsPost();
  const [outfitIndex, setOutfitIndex] = useState(0);
  const [viewedHistory, setViewedHistory] = useState<ViewedHistory | null>(
    null,
  );
  const [openLayer, setOpenLayer] = useState<OpenLayer>(null);
  const [rating, setRating] = useState(0);
  const [sessionRejection, setSessionRejection] =
    useState<SessionRejection>(null);
  const [isLeaveDialogOpen, setIsLeaveDialogOpen] = useState(false);
  const [leaveTarget, setLeaveTarget] = useState<LeaveTarget>('input');
  const [isCanceling, setIsCanceling] = useState(false);
  const [isMovingToAdopted, setIsMovingToAdopted] = useState(false);
  const [isCheckingSessionEnd, setIsCheckingSessionEnd] = useState(false);
  const isLeaveAllowedRef = useRef(false);
  const urlRestoreRef = useRef<Promise<void> | null>(null);
  const leaveFocusRef = useRef<HTMLButtonElement>(null);
  const infoButtonRef = useRef<HTMLButtonElement>(null);
  const adoptButtonRef = useRef<HTMLButtonElement>(null);
  const requestButtonRef = useRef<HTMLButtonElement>(null);

  const isProcessing =
    result !== undefined && getRecommendationProgress(result) === 'processing';
  const isSubmittingRating =
    isRatingPending || isMovingToAdopted || isCheckingSessionEnd;
  // 채택이나 취소가 끝나는 사이에 재조회가 도착해도 세션이 끝난 것으로 안내하지 않는다.
  const isResultGone =
    result !== undefined &&
    !isProcessing &&
    !isSubmittingRating &&
    !isCanceling &&
    !canViewRecommendationResult(result);
  const isAdopted = result?.session_status_cd === 'completed';
  const hasOutfits = result !== undefined && result.outfits.length > 0;
  const isNotFound =
    error instanceof ApiError && error.status === NOT_FOUND_STATUS;
  const isLoadRejected =
    result === undefined && isClientError(error) && !isUnauthorizedError(error);
  const isUnavailable =
    sessionRejection === 'unavailable' ||
    isNotFound ||
    isLoadRejected ||
    (isResultGone && (!hasOutfits || isAdopted));
  const isExpired =
    !isUnavailable && (sessionRejection === 'expired' || isResultGone);
  const isLeaveConfirmNeeded = !isUnavailable && !isExpired && !isProcessing;
  // 로그인이 만료되면 전역 다이얼로그가 안내하므로, 그 뒤에 실패 화면을 겹치지 않고 로딩 화면을 둔다.
  const isLoadFailed =
    !isUnavailable &&
    (result === undefined || isProcessing || !hasOutfits) &&
    error !== null &&
    !isUnauthorizedError(error);
  const latestRegeneration = result?.latest_regeneration ?? null;
  const isRegenerating = isRegenerationProcessing(latestRegeneration);
  const lastRegenerationRef = useRef(latestRegeneration);

  const openLeaveDialog = (target: LeaveTarget) => {
    setOpenLayer(null);
    setLeaveTarget(target);
    setIsLeaveDialogOpen(true);
  };

  useBlocker({
    shouldBlockFn: ({ action, current, next }) => {
      if (
        !isLeaveConfirmNeeded ||
        isLeaveAllowedRef.current ||
        current.pathname === next.pathname
      ) {
        return false;
      }

      if (action === 'BACK' || action === 'FORWARD' || action === 'GO') {
        urlRestoreRef.current = waitForPopState();
      }

      // 불러오기 실패 화면에는 사라진다는 안내가 이미 있어서 [돌아가기]와 같게 처리한다.
      if (isLoadFailed) {
        if (!isCanceling) {
          void cancelAndLeave('input');
        }

        return true;
      }

      // 서랍, 별점 모달, 요청 시트가 열려 있을 때 뒤로 가기는 나가려는 것이 아니라 그 층을 닫으려는 것으로 본다.
      if (openLayer !== null) {
        if (!isSubmittingRating && !isRequestingRegeneration) {
          setOpenLayer(null);
        }
      } else if (!isLeaveDialogOpen && !isCanceling) {
        openLeaveDialog('input');
      }

      return true;
    },
    enableBeforeUnload: isLeaveConfirmNeeded,
  });

  const moveToProgress = useEffectEvent(() => {
    void navigate({
      to: '/recommendation/sessions/$sessionId',
      params: { sessionId },
      replace: true,
    });
  });

  useEffect(() => {
    if (isProcessing) {
      moveToProgress();
    }
  }, [isProcessing]);

  useEffect(() => {
    if (latestRegeneration?.regeneration_status_cd !== 'failed') {
      return;
    }

    const { request_seq: requestSeq } = latestRegeneration;

    // 실패는 응답에 계속 남아 있어서, 새로고침해도 같은 요청을 다시 알리지 않도록 기록해 둔다.
    if (
      isRegenerationFailureNoticed(
        readSessionJson(REGENERATION_FAILURE_NOTICE_STORAGE_KEY),
        sessionId,
        requestSeq,
      )
    ) {
      return;
    }

    writeSessionJson(REGENERATION_FAILURE_NOTICE_STORAGE_KEY, {
      sessionId,
      requestSeq,
    });
    showToast({
      tone: 'error',
      title: '요청을 반영하지 못했어요',
      description: '기존 코디를 유지했어요.',
    });
  }, [latestRegeneration, sessionId]);

  const noticeRegeneratedOutfit = useEffectEvent((targetOutfitId: number) => {
    const outfits = result?.outfits ?? [];
    const targetIndex = findRegeneratedOutfitIndex(outfits, targetOutfitId);
    const viewedIndex = Math.min(outfitIndex, outfits.length - 1);

    if (targetIndex >= 0 && targetIndex !== viewedIndex) {
      showToast({
        tone: 'info',
        title: `${targetIndex + 1}번째 코디에 요청을 반영했어요`,
      });
    }
  });

  useEffect(() => {
    const lastRegeneration = lastRegenerationRef.current;

    lastRegenerationRef.current = latestRegeneration;

    if (
      isRegenerationProcessing(lastRegeneration) &&
      latestRegeneration?.regeneration_status_cd === 'completed' &&
      latestRegeneration.target_outfit_id !== null
    ) {
      noticeRegeneratedOutfit(latestRegeneration.target_outfit_id);
    }
  }, [latestRegeneration]);

  useEffect(() => {
    setToastBottomOffset(openLayer === null ? OUTFIT_ACTIONS_HEIGHT : null);

    return () => {
      setToastBottomOffset(null);
    };
  }, [openLayer]);

  const leaveToInput = () => {
    void navigate({ to: '/recommendation', replace: true });
  };

  const cancelAndLeave = async (target: LeaveTarget) => {
    setIsCanceling(true);

    try {
      await cancelSession({ recommendationSessionId: sessionId });
    } catch {
      // 취소 요청이 실패해도 남은 세션은 BE의 이탈 정리가 닫는다.
    }

    await urlRestoreRef.current;
    isLeaveAllowedRef.current = true;
    setIsLeaveDialogOpen(false);

    if (target === 'clothingRegister') {
      void navigate({
        to: '/closet',
        search: { register: true },
        replace: true,
      });
      return;
    }

    leaveToInput();
  };

  // 거절 응답에는 끝난 사유가 없어서, 다시 조회해 사유를 읽은 뒤에 안내한다.
  const expireSession = async () => {
    setIsCheckingSessionEnd(true);
    await refetch();
    setIsCheckingSessionEnd(false);
    setSessionRejection('expired');
  };

  const openRatingDialog = () => {
    setRating(0);
    setOpenLayer('rating');
  };

  const openRequestSheet = () => {
    resetRegenerationRequest();
    setOpenLayer('request');
  };

  const leaveDialog = (
    <Dialog
      isOpen={isLeaveConfirmNeeded && isLeaveDialogOpen}
      onOpenChange={setIsLeaveDialogOpen}
      title="추천을 그만둘까요?"
      description={'받은 코디가 모두 사라지고\n되돌릴 수 없어요.'}
      isDismissable={!isCanceling}
      finalFocus={isExpired ? undefined : leaveFocusRef}
      footer={
        <>
          <Button
            variant="outline"
            isFullWidth
            isLoading={isCanceling}
            onClick={() => void cancelAndLeave(leaveTarget)}
          >
            그만두기
          </Button>
          <Button
            variant="text"
            isFullWidth
            isDisabled={isCanceling}
            onClick={() => setIsLeaveDialogOpen(false)}
          >
            계속 보기
          </Button>
        </>
      }
    />
  );

  if (isUnavailable) {
    return (
      <S.StatusPage>
        <TopBar />
        <StatusView
          visual={<Icon name="search_off" size="2xl" />}
          title="볼 수 없는 추천이에요"
          description="이미 끝났거나 채택한 추천이에요."
          actions={
            <Button
              isFullWidth
              onClick={() => void navigate({ to: '/closet', replace: true })}
            >
              옷장으로 가기
            </Button>
          }
        />
      </S.StatusPage>
    );
  }

  if (result === undefined || isProcessing || !hasOutfits) {
    if (isLoadFailed) {
      return (
        <S.StatusPage>
          <TopBar />
          <StatusView
            visual={<Icon name="error" size="2xl" />}
            title="코디를 불러오지 못했어요"
            description={`${error.message}\n돌아가면 이번 추천은 사라져요.`}
            actions={
              <>
                <Button
                  ref={leaveFocusRef}
                  icon="refresh"
                  isFullWidth
                  isLoading={isFetching}
                  isDisabled={isCanceling}
                  onClick={() => void refetch()}
                >
                  다시 시도
                </Button>
                <Button
                  variant="outline"
                  size="md"
                  isFullWidth
                  isLoading={isCanceling}
                  onClick={() => void cancelAndLeave('input')}
                >
                  돌아가기
                </Button>
              </>
            }
          />
          {leaveDialog}
        </S.StatusPage>
      );
    }

    return (
      <S.Container>
        <S.CloseButton>
          <IconButton
            ref={leaveFocusRef}
            icon="close"
            aria-label="추천 그만두기"
            onClick={() => openLeaveDialog('input')}
          />
        </S.CloseButton>
        <OutfitLoading />
        {leaveDialog}
      </S.Container>
    );
  }

  const { outfits, weather, is_clothing_shortage: isClothingShortage } = result;
  const currentIndex = Math.min(outfitIndex, outfits.length - 1);
  const latestOutfit = outfits[currentIndex];

  // 재추천이 끝나면 최신 코디의 번호가 바뀌므로, 보던 이전 코디를 따로 지우지 않아도 최신으로 돌아온다.
  const getHistoryDepth = (outfit: OutfitResult) =>
    viewedHistory?.latestOutfitId === outfit.outfit_id
      ? Math.min(viewedHistory.depth, outfit.previous_outfits.length)
      : 0;

  const historyDepth = getHistoryDepth(latestOutfit);
  const currentOutfit = getOutfitLayers(latestOutfit)[historyDepth];
  const isViewingPrevious = historyDepth > 0;

  // 넘기는 동안 빠져나가는 카드의 내용이 바뀌어 보이지 않도록, 전환이 끝난 뒤에 그 세트를 최신으로 돌린다.
  const resetLeftHistory = () => {
    if (viewedHistory?.latestOutfitId !== latestOutfit.outfit_id) {
      setViewedHistory(null);
    }
  };

  // 전환이 끝나기 전에 돌아와도 떠났던 세트는 최신으로 보여 준다.
  const moveToOutfit = (nextIndex: number) => {
    setOutfitIndex(nextIndex);

    if (viewedHistory?.latestOutfitId === outfits[nextIndex].outfit_id) {
      setViewedHistory(null);
    }
  };

  const moveToAdopted = async () => {
    setIsMovingToAdopted(true);
    // 채택 완료 화면이 로딩 없이 바로 그려지도록 내역을 먼저 받아 둔다. 실패하면 그 화면이 다시 불러온다.
    await queryClient.prefetchQuery({
      ...getGetRecommendationHistoryDetailRecommendationHistoryRecommendationSessionIdGetQueryOptions(
        sessionId,
      ),
      retry: false,
    });
    await urlRestoreRef.current;
    isLeaveAllowedRef.current = true;
    await navigate({
      to: '/recommendation/sessions/$sessionId/adopted',
      params: { sessionId },
      replace: true,
    });
  };

  const submitRating = () => {
    rateOutfit(
      {
        recommendationSessionId: sessionId,
        data: { outfit_id: currentOutfit.outfit_id, rating },
      },
      {
        onSuccess: () => void moveToAdopted(),
        onError: (ratingError) => {
          if (isUnauthorizedError(ratingError)) {
            return;
          }

          if (
            ratingError.code === SESSION_ALREADY_SETTLED_CODE ||
            ratingError.code === SESSION_NOT_FOUND_CODE
          ) {
            setSessionRejection('unavailable');
            return;
          }

          if (ratingError.code === SESSION_NOT_RATABLE_CODE) {
            void expireSession();
            return;
          }

          showToast({
            tone: 'error',
            title: '코디를 채택하지 못했어요',
            description: ratingError.message,
          });
        },
      },
    );
  };

  const submitRegenerationRequest = (
    requestText: string,
    targetScope: RegenerationScope,
  ) => {
    const targetOutfitId =
      targetScope === 'single' ? latestOutfit.outfit_id : null;

    requestRegeneration(
      {
        recommendationSessionId: sessionId,
        data: {
          request_text: requestText,
          target_scope_cd: targetScope,
          target_outfit_id: targetOutfitId,
        },
      },
      {
        onSuccess: ({ request_seq: requestSeq }) => {
          // 다음 폴링을 기다리지 않고 덮개를 바로 씌운 뒤, 서버의 상태로 이어 간다.
          queryClient.setQueryData<RecommendationResult>(
            getGetRecommendationResultRecommendationSessionsRecommendationSessionIdGetQueryKey(
              sessionId,
            ),
            (current) =>
              current && {
                ...current,
                latest_regeneration: {
                  request_seq: requestSeq,
                  regeneration_status_cd: 'processing',
                  target_scope_cd: targetScope,
                  target_outfit_id: targetOutfitId,
                  target_slot_cd: null,
                },
              },
          );
          setOpenLayer(null);
          void refetch();
        },
        onError: (requestError) => {
          if (requestError.code === SESSION_ENDED_CODE) {
            void expireSession();
          } else if (
            requestError.code === SESSION_NOT_FOUND_CODE ||
            requestError.code === SESSION_ALREADY_SETTLED_CODE
          ) {
            setSessionRejection('unavailable');
          }
        },
      },
    );
  };

  return (
    <S.Container>
      {outfits.length > 1 && (
        <S.Counter>
          <S.CounterCurrent>{currentIndex + 1}</S.CounterCurrent>
          <S.CounterTotal>/ {outfits.length}</S.CounterTotal>
        </S.Counter>
      )}
      <S.CloseButton>
        <IconButton
          ref={leaveFocusRef}
          icon="close"
          aria-label="추천 그만두기"
          onClick={() => openLeaveDialog('input')}
        />
      </S.CloseButton>
      <S.CarouselArea>
        <Carousel
          aria-label="추천 코디"
          index={currentIndex}
          onIndexChange={moveToOutfit}
          onSettle={resetLeftHistory}
          isLooped={false}
          arrowVariant="plain"
          arrowInset={S.ARROW_INSET}
        >
          {outfits.map((outfit) => (
            <S.Slide key={outfit.outfit_seq}>
              <OutfitStack
                outfit={outfit}
                depth={getHistoryDepth(outfit)}
                isRegenerating={isOutfitRegenerating(
                  latestRegeneration,
                  outfit.outfit_id,
                )}
                onDepthChange={(depth) => {
                  setViewedHistory({
                    latestOutfitId: outfit.outfit_id,
                    depth,
                  });
                }}
              />
            </S.Slide>
          ))}
        </Carousel>
      </S.CarouselArea>
      <OutfitActions
        infoButtonRef={infoButtonRef}
        adoptButtonRef={adoptButtonRef}
        requestButtonRef={requestButtonRef}
        isDisabled={isOutfitRegenerating(
          latestRegeneration,
          latestOutfit.outfit_id,
        )}
        isRequestDisabled={isViewingPrevious || isRegenerating}
        onInfoClick={() => setOpenLayer('info')}
        onAdoptClick={openRatingDialog}
        onRequestClick={openRequestSheet}
      />
      <OutfitInfoSheet
        outfit={currentOutfit}
        weather={weather}
        isClothingShortage={isClothingShortage}
        isRequestDisabled={isViewingPrevious || isRegenerating}
        isOpen={openLayer === 'info' && !isExpired}
        onOpenChange={(isOpen) => setOpenLayer(isOpen ? 'info' : null)}
        onAdoptClick={openRatingDialog}
        onRequestClick={openRequestSheet}
        onRegisterClothingClick={() => openLeaveDialog('clothingRegister')}
        finalFocus={
          openLayer !== null || isLeaveDialogOpen || isExpired
            ? undefined
            : infoButtonRef
        }
      />
      <RegenerationRequestSheet
        isOpen={openLayer === 'request' && !isExpired}
        onOpenChange={(isOpen) => setOpenLayer(isOpen ? 'request' : null)}
        outfitCount={outfits.length}
        isSubmitting={isRequestingRegeneration || isCheckingSessionEnd}
        errorMessage={
          regenerationRequestError === null ||
          isCheckingSessionEnd ||
          isExpired ||
          isUnauthorizedError(regenerationRequestError)
            ? undefined
            : regenerationRequestError.message
        }
        onTextChange={resetRegenerationRequest}
        onSubmit={submitRegenerationRequest}
        finalFocus={
          isExpired ||
          isLeaveDialogOpen ||
          isOutfitRegenerating(latestRegeneration, latestOutfit.outfit_id)
            ? undefined
            : requestButtonRef
        }
      />
      <RatingDialog
        isOpen={openLayer === 'rating' && !isExpired}
        rating={rating}
        isSubmitting={isSubmittingRating}
        onRatingChange={setRating}
        onSubmit={submitRating}
        onClose={() => setOpenLayer(null)}
        finalFocus={isExpired || isLeaveDialogOpen ? undefined : adoptButtonRef}
      />
      {leaveDialog}
      <Dialog
        isOpen={isExpired}
        onOpenChange={() => {}}
        title="추천이 끝났어요"
        description={
          result.session_status_cd === 'canceled'
            ? '다른 화면에서 추천을 그만뒀어요.\n새로 추천받아 주세요.'
            : '30분 동안 아무 동작이 없어 끝났어요.\n새로 추천받아 주세요.'
        }
        isDismissable={false}
        footer={
          <Button isFullWidth onClick={leaveToInput}>
            새로 추천받기
          </Button>
        }
      />
    </S.Container>
  );
};

export default RecommendationResultPage;
