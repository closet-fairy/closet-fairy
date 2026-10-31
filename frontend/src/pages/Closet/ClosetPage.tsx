import { useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { useCallback, useEffect, useState } from 'react';
import { isUnauthorizedError } from '@/apis/authSession';
import Button from '@/components/common/Button';
import Icon from '@/components/common/Icon';
import StatusView from '@/components/common/StatusView';
import { useToastStackHeight } from '@/components/common/Toaster/Toaster.hooks';
import TopBar from '@/components/common/TopBar';
import DeleteClothingDialog from '@/components/DeleteClothingDialog';
import type { ClothingCard as ClothingCardData } from '@/generated/models';
import useLoadMoreTrigger from '@/hooks/useLoadMoreTrigger';
import {
  dismissClothingUpload,
  resendClothingUpload,
} from './clothingUploadStore';
import ClothingCard from './components/ClothingCard';
import ClothingRegistration from './components/ClothingRegistration';
import ClothingStatusDialog from './components/ClothingStatusDialog';
import UploadCard from './components/UploadCard';
import useClosetClothingList from './hooks/useClosetClothingList';
import useClothingStatusPolling from './hooks/useClothingStatusPolling';
import useClothingUploads from './hooks/useClothingUploads';
import useRetryClothing from './hooks/useRetryClothing';
import type { ClothingStatusDialogVariant } from './types';
import * as S from './ClosetPage.styled';

interface StatusDialogContent {
  variant: ClothingStatusDialogVariant;
  failureReason: string | null;
}

/*
 * 다이얼로그에 그리는 내용을 상태로 들고 있는다. 열려 있는 동안에는 옷의 실제 상태를 따라가고,
 * 닫히는 동안에는 마지막 내용을 그대로 둬서 닫히는 모습이 다른 내용으로 바뀌어 보이지 않게 한다.
 */
interface StatusDialogState extends StatusDialogContent {
  clothingId: number;
  isOpen: boolean;
}

interface DeleteDialogState {
  clothingId: number;
  isOpen: boolean;
}

const toDialogContent = (
  clothing: ClothingCardData,
): StatusDialogContent | null => {
  if (clothing.processing_status_cd === 'completed') {
    return null;
  }

  return {
    variant: clothing.processing_status_cd,
    failureReason: clothing.failure_reason,
  };
};

const ClosetPage = () => {
  const listQuery = useClosetClothingList();
  const clothings = listQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const [statusDialog, setStatusDialog] = useState<StatusDialogState | null>(
    null,
  );
  const [deleteDialog, setDeleteDialog] = useState<DeleteDialogState | null>(
    null,
  );
  const toastStackHeight = useToastStackHeight();
  const queryClient = useQueryClient();
  const { uploads } = useClothingUploads();
  const search = useSearch({ from: '/closet' });
  const navigate = useNavigate();
  // 다른 화면의 [옷 등록하기]로 들어오면 등록 방법 시트를 열어 둔 채로 시작한다.
  const [isRegisterSheetOpen, setIsRegisterSheetOpen] = useState(
    search.register === true,
  );
  const hasSearch = search.register !== undefined;

  useEffect(() => {
    if (hasSearch) {
      void navigate({ to: '/closet', search: {}, replace: true });
    }
  }, [hasSearch, navigate]);

  if (statusDialog?.isOpen && listQuery.data !== undefined) {
    const dialogClothing = clothings.find(
      (clothing) => clothing.clothing_id === statusDialog.clothingId,
    );
    const liveContent =
      dialogClothing === undefined ? null : toDialogContent(dialogClothing);

    // 처리가 끝났거나 지워진 옷이면 닫고, 아직이면 바뀐 상태(처리 중 → 실패 등)를 따라간다.
    if (liveContent === null) {
      setStatusDialog({ ...statusDialog, isOpen: false });
    } else if (
      liveContent.variant !== statusDialog.variant ||
      liveContent.failureReason !== statusDialog.failureReason
    ) {
      setStatusDialog({ ...statusDialog, ...liveContent });
    }
  }

  const closeStatusDialog = (clothingId: number) => {
    setStatusDialog((dialog) =>
      dialog?.clothingId === clothingId ? { ...dialog, isOpen: false } : dialog,
    );
  };

  const { retry, retryingIds } = useRetryClothing({
    onRetried: closeStatusDialog,
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

  const openRegisterSheet = () => setIsRegisterSheetOpen(true);

  const uploadCards = uploads.map((upload) => (
    <S.GridItem key={upload.id}>
      <UploadCard
        upload={upload}
        onResend={() => void resendClothingUpload(queryClient, upload.id)}
        onDismiss={() => dismissClothingUpload(upload.id)}
      />
    </S.GridItem>
  ));
  // 목록을 아직 못 받았어도 보내는 중이거나 실패한 사진은 치우거나 다시 보낼 수 있게 위에 그려 둔다.
  const pendingUploadGrid = uploads.length > 0 && (
    <S.Grid>{uploadCards}</S.Grid>
  );

  const renderBody = () => {
    // 로그인이 만료되면 전역 다이얼로그가 안내하므로, 그 뒤에 실패 화면을 겹치지 않고 로딩 화면을 둔다.
    if (
      listQuery.isPending ||
      (listQuery.data === undefined && isUnauthorizedError(listQuery.error))
    ) {
      return (
        <>
          {pendingUploadGrid}
          <StatusView
            visual={
              <S.Spinner>
                <Icon name="progress_activity" size="xl" />
              </S.Spinner>
            }
            title="옷장을 불러오는 중이에요"
          />
        </>
      );
    }

    // 다음 묶음을 불러오다 실패해도 쿼리 전체가 error가 되므로, 받아 둔 목록이 없을 때만 실패 화면을 보여 준다.
    if (listQuery.data === undefined) {
      return (
        <>
          {pendingUploadGrid}
          <StatusView
            visual={<Icon name="error" size="xl" />}
            title="옷장을 불러오지 못했어요"
            description={listQuery.error?.message}
            actions={
              <Button
                icon="refresh"
                isFullWidth
                isLoading={listQuery.isFetching}
                onClick={() => void listQuery.refetch()}
              >
                다시 시도
              </Button>
            }
          />
        </>
      );
    }

    if (clothings.length === 0 && uploads.length === 0) {
      return (
        <StatusView
          visual={
            <S.EmptyVisual>
              <Icon name="checkroom" size="xl" />
            </S.EmptyVisual>
          }
          title="옷장이 비어 있어요"
          description="옷을 등록하면 그 옷으로 코디를 추천받을 수 있어요."
          actions={
            <Button
              icon="add_a_photo"
              isFullWidth
              aria-haspopup="dialog"
              onClick={openRegisterSheet}
            >
              옷 등록하기
            </Button>
          }
        />
      );
    }

    return (
      <>
        <S.Grid>
          {uploadCards}
          {clothings.map((clothing) => (
            <S.GridItem key={clothing.clothing_id}>
              <ClothingCard
                clothing={clothing}
                isRetrying={retryingIds.has(clothing.clothing_id)}
                onShowStatus={() => {
                  const content = toDialogContent(clothing);

                  if (content !== null) {
                    setStatusDialog({
                      clothingId: clothing.clothing_id,
                      isOpen: true,
                      ...content,
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
          aria-haspopup="dialog"
          $toastStackHeight={toastStackHeight}
          onClick={openRegisterSheet}
        >
          <Icon name="add" size="lg" />
        </S.Fab>
        {statusDialog !== null && (
          <ClothingStatusDialog
            isOpen={statusDialog.isOpen}
            variant={statusDialog.variant}
            failureReason={statusDialog.failureReason}
            isRetrying={retryingIds.has(statusDialog.clothingId)}
            onRetry={() => retry(statusDialog.clothingId)}
            onDelete={() => {
              closeStatusDialog(statusDialog.clothingId);
              setDeleteDialog({
                clothingId: statusDialog.clothingId,
                isOpen: true,
              });
            }}
            onClose={() => closeStatusDialog(statusDialog.clothingId)}
          />
        )}
      </>
    );
  };

  // 상태가 바뀌어 본문이 바뀌어도 등록 흐름은 그대로 남도록 본문과 따로 둔다.
  return (
    <S.Container>
      <TopBar title="옷장" />
      {renderBody()}
      {/* 마지막 옷을 지워 본문이 빈 화면으로 바뀌어도 모달이 닫히는 모습을 마저 보여 주도록 본문 밖에 둔다. */}
      {deleteDialog !== null && (
        <DeleteClothingDialog
          key={deleteDialog.clothingId}
          clothingId={deleteDialog.clothingId}
          isOpen={deleteDialog.isOpen}
          onOpenChange={(isOpen) =>
            setDeleteDialog({ ...deleteDialog, isOpen })
          }
          onDeleted={() => setDeleteDialog({ ...deleteDialog, isOpen: false })}
        />
      )}
      <ClothingRegistration
        isSheetOpen={isRegisterSheetOpen}
        onSheetOpenChange={setIsRegisterSheetOpen}
      />
    </S.Container>
  );
};

export default ClosetPage;
