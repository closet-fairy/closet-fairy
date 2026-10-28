import { useListClothingClothingGetInfinite } from '@/generated/endpoints/clothing/clothing';
import { CLOSET_LIST_PARAMS } from '@/pages/Closet/constants';

const useClosetClothingList = () =>
  useListClothingClothingGetInfinite(CLOSET_LIST_PARAMS, {
    query: {
      initialPageParam: null,
      getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
    },
  });

export default useClosetClothingList;
