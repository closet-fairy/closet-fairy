import { useCallback } from 'react';
import Button from '@/components/common/Button';
import Icon from '@/components/common/Icon';
import StatusView from '@/components/common/StatusView';
import TopBar from '@/components/common/TopBar';
import ClothingCard from './components/ClothingCard';
import useClosetClothingList from './hooks/useClosetClothingList';
import useLoadMoreTrigger from './hooks/useLoadMoreTrigger';
import * as S from './ClosetPage.styled';

const ClosetPage = () => {
  const listQuery = useClosetClothingList();
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

  if (listQuery.isPending) {
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

  const clothings = listQuery.data.pages.flatMap((page) => page.items);

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
          <ClothingCard key={clothing.clothing_id} clothing={clothing} />
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
      <S.Fab type="button" aria-label="옷 등록하기">
        <Icon name="add" size="lg" />
      </S.Fab>
    </S.Container>
  );
};

export default ClosetPage;
