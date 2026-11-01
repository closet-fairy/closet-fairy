import { useNavigate } from '@tanstack/react-router';
import { useCallback } from 'react';
import { isClientError } from '@/apis/apiError';
import { isUnauthorizedError } from '@/apis/authSession';
import Button from '@/components/common/Button';
import Icon from '@/components/common/Icon';
import StatusView from '@/components/common/StatusView';
import TopBar from '@/components/common/TopBar';
import useLoadMoreTrigger from '@/hooks/useLoadMoreTrigger';
import HistoryCard from './components/HistoryCard';
import HistoryCardSkeleton from './components/HistoryCardSkeleton';
import useRecommendationHistoryList from './hooks/useRecommendationHistoryList';
import * as S from './RecommendationHistoryPage.styled';

const FIRST_LOAD_SKELETON_COUNT = 3;

const RecommendationHistoryPage = () => {
  const navigate = useNavigate();
  const listQuery = useRecommendationHistoryList();
  // 켜 둔 채 날이 바뀌어도 어제, 오늘 표기가 맞도록 데이터를 받은 시각을 기준으로 삼는다.
  const now = new Date(listQuery.dataUpdatedAt);
  const items = listQuery.data?.pages.flatMap((page) => page.items) ?? [];

  const { fetchNextPage, hasNextPage, isFetchingNextPage } = listQuery;
  const loadNextPage = useCallback(() => {
    void fetchNextPage();
  }, [fetchNextPage]);
  const isNextPageFailed =
    listQuery.isFetchNextPageError && !isFetchingNextPage;
  const loadMoreRef = useLoadMoreTrigger({
    isEnabled: hasNextPage && !listQuery.isFetching && !isNextPageFailed,
    onLoadMore: loadNextPage,
  });

  const renderBody = () => {
    // 로그인이 만료되면 전역 다이얼로그가 안내하므로, 그 뒤에 실패 화면을 겹치지 않고 로딩 화면을 둔다.
    if (
      listQuery.isPending ||
      (listQuery.data === undefined && isUnauthorizedError(listQuery.error))
    ) {
      return (
        <>
          <S.List>
            {Array.from({ length: FIRST_LOAD_SKELETON_COUNT }, (_, index) => (
              <li key={index} aria-hidden="true">
                <HistoryCardSkeleton index={index} />
              </li>
            ))}
          </S.List>
          <S.LoadingMessage role="status">
            추천 내역을 불러오는 중이에요
          </S.LoadingMessage>
        </>
      );
    }

    // 다음 묶음을 불러오다 실패해도 쿼리 전체가 error가 되므로, 받아 둔 목록이 없을 때만 실패 화면을 보여 준다.
    if (listQuery.data === undefined) {
      return (
        <StatusView
          visual={<Icon name="error" size="2xl" />}
          title="추천 내역을 불러오지 못했어요"
          description={listQuery.error?.message}
          actions={
            !isClientError(listQuery.error) && (
              <Button
                icon="refresh"
                isFullWidth
                isLoading={listQuery.isFetching}
                onClick={() => void listQuery.refetch()}
              >
                다시 시도
              </Button>
            )
          }
        />
      );
    }

    if (items.length === 0) {
      return (
        <StatusView
          visual={<Icon name="history" size="2xl" />}
          title="아직 남긴 코디가 없어요"
          description="코디를 추천받고 채택하면 여기에 쌓여요."
          actions={
            <Button
              isFullWidth
              onClick={() => void navigate({ to: '/recommendation' })}
            >
              코디 추천받기
            </Button>
          }
        />
      );
    }

    return (
      <>
        <S.List>
          {items.map((item) => (
            <li key={item.recommendation_session_id}>
              <S.CardLink
                to="/recommendation-history/$sessionId"
                params={{ sessionId: item.recommendation_session_id }}
              >
                <HistoryCard item={item} now={now} />
              </S.CardLink>
            </li>
          ))}
          {isFetchingNextPage && (
            <li aria-hidden="true">
              <HistoryCardSkeleton index={0} />
            </li>
          )}
        </S.List>
        <S.ListEnd ref={loadMoreRef}>
          {isFetchingNextPage && (
            <S.LoadingMessage role="status">더 불러오는 중</S.LoadingMessage>
          )}
          {isNextPageFailed && (
            <>
              <S.ListEndMessage role="alert">
                더 불러오지 못했어요
              </S.ListEndMessage>
              {!isClientError(listQuery.error) && (
                <Button
                  variant="outline"
                  size="sm"
                  icon="refresh"
                  onClick={loadNextPage}
                >
                  다시 시도
                </Button>
              )}
            </>
          )}
        </S.ListEnd>
      </>
    );
  };

  return (
    <S.Container>
      <TopBar title="추천 내역" />
      {renderBody()}
    </S.Container>
  );
};

export default RecommendationHistoryPage;
