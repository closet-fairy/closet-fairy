import { useListRecommendationHistoryRecommendationHistoryGetInfinite } from '@/generated/endpoints/recommendation/recommendation';

const useRecommendationHistoryList = () =>
  useListRecommendationHistoryRecommendationHistoryGetInfinite(undefined, {
    query: {
      initialPageParam: null,
      getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
    },
  });

export default useRecommendationHistoryList;
