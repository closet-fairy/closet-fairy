import { useCallback, useState } from 'react';
import { isUnauthorizedError } from '@/apis/authSession';
import Button from '@/components/common/Button';
import Icon from '@/components/common/Icon';
import StatusView from '@/components/common/StatusView';
import { useToastStackHeight } from '@/components/common/Toaster/Toaster.hooks';
import TopBar from '@/components/common/TopBar';
import type { ClothingCard as ClothingCardData } from '@/generated/models';
import ClothingCard from './components/ClothingCard';
import ClothingStatusDialog from './components/ClothingStatusDialog';
import type { ClothingStatusDialogVariant } from './components/ClothingStatusDialog/ClothingStatusDialog';
import useClosetClothingList from './hooks/useClosetClothingList';
import useClothingStatusPolling from './hooks/useClothingStatusPolling';
import useLoadMoreTrigger from './hooks/useLoadMoreTrigger';
import useRetryClothing from './hooks/useRetryClothing';
import * as S from './ClosetPage.styled';

interface StatusDialogState {
  clothingId: number;
  isOpen: boolean;
  // 닫히는 동안 내용이 다른 상태로 바뀌어 보이지 않도록, 열 때와 닫을 때의 상태를 기억해 둔다.
  variant: ClothingStatusDialogVariant;
}

const toDialogVariant = (
  clothing: ClothingCardData,
): ClothingStatusDialogVariant | null => {
  if (clothing.processing_status_cd === 'completed') {
    return null;
  }

  return clothing.processing_status_cd;
};

const ClosetPage = () => {
  const listQuery = useClosetClothingList();
  const clothings = listQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const [statusDialog, setStatusDialog] = useState<StatusDialogState | null>(
    null,
  );
  const dialogClothing = clothings.find(
    (clothing) => clothing.clothing_id === statusDialog?.clothingId,
  );
  const liveDialogVariant =
    dialogClothing === undefined ? null : toDialogVariant(dialogClothing);
  const toastStackHeight = useToastStackHeight();

  const closeStatusDialog = () => {
    setStatusDialog((dialog) =>
      dialog === null
        ? dialog
        : {
            ...dialog,
            isOpen: false,
            variant: liveDialogVariant ?? dialog.variant,
          },
    );
  };

  const { retry, retryingIds } = useRetryClothing({
    onRetried: (clothingId) => {
      if (statusDialog?.clothingId === clothingId) {
        closeStatusDialog();
      }
    },
  });

  // 목록을 다시 받는 동안에는 묻지 않는다. 그사이 끝난 옷을 또 끝났다고 받아 재조회가 겹치지 않게 한다.
  useClothingStatusPolling({ clothings, isEnabled: !listQuery.isFetching });

  const { fetchNextPage, hasNextPage, isFetchingNextPage } = listQuery;
  const loadNextPage = useCallback(() => {
    void fetchNextPage();
  }, [fetchNextPage]);
  const isNextPageFailed =
    listQuery.isFetchNextPageError && !isFetchingNextPage;
  /*
   * fetchNextPage는 진행 중인 요청을 취소하고 다시 보내므로, 화면에 돌아와 전체 목록을 다시 받는 동안에는
   * 끝 감지를 멈춘다. 그러지 않으면 그 새로고침이 버려져 처리가 끝난 옷이 계속 처리 중으로 남는다.
   */
  const loadMoreRef = useLoadMoreTrigger({
    isEnabled: hasNextPage && !listQuery.isFetching && !isNextPageFailed,
    onLoadMore: loadNextPage,
  });

  // 로그인이 만료되면 전역 다이얼로그가 안내하므로, 그 뒤에 실패 화면을 겹치지 않고 로딩 화면을 둔다.
  if (
    listQuery.isPending ||
    (listQuery.data === undefined && isUnauthorizedError(listQuery.error))
  ) {
    return (
      <S.Container>
        <TopBar title="옷장" />
        <StatusView
          visual={
            <S.Spinner>
              <Icon name="progress_activity" size="xl" />
            </S.Spinner>
          }
          title="옷장을 불러오는 중이에요"
        />
      </S.Container>
    );
  }

  // 다음 묶음을 불러오다 실패해도 쿼리 전체가 error가 되므로, 받아 둔 목록이 없을 때만 실패 화면을 보여 준다.
  if (listQuery.data === undefined) {
    return (
      <S.Container>
        <TopBar title="옷장" />
        <StatusView
          visual={<Icon name="error" size="xl" />}
          title="옷장을 불러오지 못했어요"
          description={listQuery.error?.message}
          actions={
            <Button
              icon="refresh"
              isFullWidth
              onClick={() => void listQuery.refetch()}
            >
              다시 시도
            </Button>
          }
        />
      </S.Container>
    );
  }

  if (clothings.length === 0) {
    return (
      <S.Container>
        <TopBar title="옷장" />
        <StatusView
          visual={
            <S.EmptyVisual>
              <Icon name="checkroom" size="xl" />
            </S.EmptyVisual>
          }
          title="옷장이 비어 있어요"
          description="옷을 등록하면 그 옷으로 코디를 추천받을 수 있어요."
          actions={
            <Button icon="add_a_photo" isFullWidth>
              옷 등록하기
            </Button>
          }
        />
      </S.Container>
    );
  }

  return (
    <S.Container>
      <TopBar title="옷장" />
      <S.Grid>
        {clothings.map((clothing) => (
          <S.GridItem key={clothing.clothing_id}>
            <ClothingCard
              clothing={clothing}
              isRetrying={retryingIds.has(clothing.clothing_id)}
              onShowStatus={() => {
                const variant = toDialogVariant(clothing);

                if (variant !== null) {
                  setStatusDialog({
                    clothingId: clothing.clothing_id,
                    isOpen: true,
                    variant,
                  });
                }
              }}
              onRetry={() => retry(clothing.clothing_id)}
            />
          </S.GridItem>
        ))}
      </S.Grid>
      <S.ListEnd ref={loadMoreRef}>
        {isFetchingNextPage && (
          <S.Spinner>
            <Icon name="progress_activity" size="md" label="더 불러오는 중" />
          </S.Spinner>
        )}
        {isNextPageFailed && (
          <>
            <S.ListEndMessage role="alert">
              더 불러오지 못했어요
            </S.ListEndMessage>
            <Button
              variant="outline"
              size="sm"
              icon="refresh"
              onClick={loadNextPage}
            >
              다시 시도
            </Button>
          </>
        )}
      </S.ListEnd>
      <S.Fab
        type="button"
        aria-label="옷 등록하기"
        $toastStackHeight={toastStackHeight}
      >
        <Icon name="add" size="lg" />
      </S.Fab>
      {statusDialog !== null && (
        <ClothingStatusDialog
          // 처리가 끝났거나 지워진 옷이면 다이얼로그를 닫는다.
          isOpen={statusDialog.isOpen && liveDialogVariant !== null}
          variant={
            statusDialog.isOpen && liveDialogVariant !== null
              ? liveDialogVariant
              : statusDialog.variant
          }
          failureReason={dialogClothing?.failure_reason ?? null}
          isRetrying={retryingIds.has(statusDialog.clothingId)}
          onRetry={() => retry(statusDialog.clothingId)}
          onClose={closeStatusDialog}
        />
      )}
    </S.Container>
  );
};

export default ClosetPage;
