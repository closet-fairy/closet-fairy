import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { ApiError } from '@/apis/apiError';
import { isUnauthorizedError } from '@/apis/authSession';
import { patchClothingCard } from '@/apis/clothingListCache';
import { showToast } from '@/components/common/ToastProvider/ToastProvider.toast';
import {
  getGetClothingClothingClothingIdGetQueryKey,
  updateClothingClothingClothingIdPatch,
} from '@/generated/endpoints/clothing/clothing';
import type { ClothingDetail, ClothingUpdate } from '@/generated/models';

export type AttributeField = keyof ClothingUpdate;

const UNKNOWN_SAVE_ERROR = '저장하지 못했어요.';

const CLOTHING_NOT_FOUND_CODE = 'CLOTHING_NOT_FOUND';

/*
 * 속성은 바꾸는 즉시 그 필드만 저장한다. 화면에는 먼저 바꾼 값을 보여 주고(낙관적 반영), 한 옷의 요청은
 * 차례대로 보내 빠르게 여러 번 눌러도 마지막 값이 남게 한다. 실패하면 그 필드만 서버 값으로 되돌린다.
 */
const useClothingAttributeSave = (clothingId: number) => {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<ClothingUpdate>({});
  const [errors, setErrors] = useState<Partial<Record<AttributeField, string>>>(
    {},
  );
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const latestTokenRef = useRef<Partial<Record<AttributeField, number>>>({});
  const tokenRef = useRef(0);
  const isMountedRef = useRef(true);
  const detailQueryKey =
    getGetClothingClothingClothingIdGetQueryKey(clothingId);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const clearPending = (field: AttributeField) => {
    setPending((current) => {
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const clearError = (field: AttributeField) => {
    setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const save = (
    field: AttributeField,
    update: ClothingUpdate,
    failureTitle: string,
  ) => {
    tokenRef.current += 1;
    const token = tokenRef.current;
    latestTokenRef.current[field] = token;
    const isLatest = () => latestTokenRef.current[field] === token;

    setPending((current) => ({ ...current, ...update }));

    // 악세서리가 아닌 분류로 바꾸면 종류 행이 사라지므로, 그 행에 남은 실패 문구도 함께 지운다.
    if (field === 'category_cd' && update.category_cd !== 'accessories') {
      clearError('accessory_type_cd');
    }

    queueRef.current = queueRef.current.then(async () => {
      /*
       * 앞서 보낸 분류 변경이 실패해 악세서리가 아니게 됐다면, 기다리던 종류 저장은 서버가 거절하므로 보내지 않는다.
       * 요청은 차례대로 나가므로 이때 캐시의 분류가 서버의 분류다.
       */
      if (
        field === 'accessory_type_cd' &&
        queryClient.getQueryData<ClothingDetail>(detailQueryKey)
          ?.category_cd !== 'accessories'
      ) {
        if (isLatest()) {
          clearPending(field);
        }
        return;
      }

      try {
        const updated = await updateClothingClothingClothingIdPatch(
          clothingId,
          update,
        );
        // 저장 전에 나간 상세 조회가 늦게 도착해 저장한 값을 옛 값으로 덮지 않게 한다.
        await queryClient.cancelQueries({ queryKey: detailQueryKey });
        queryClient.setQueryData(detailQueryKey, updated);
        patchClothingCard(queryClient, clothingId, {
          item_name: updated.item_name,
          category_cd: updated.category_cd,
          is_new: updated.is_new,
        });

        if (isLatest()) {
          clearPending(field);
          clearError(field);
        }
      } catch (error) {
        // 로그인 만료는 전역 다이얼로그가 안내한다.
        if (isUnauthorizedError(error)) {
          return;
        }

        const message =
          error instanceof ApiError && error.message !== ''
            ? error.message
            : UNKNOWN_SAVE_ERROR;

        /*
         * 응답이 오기 전에 상세를 떠났다면 행 아래 문구를 볼 수 없으므로, 마지막으로 바꾼 값의 실패만 토스트로 알린다.
         * 저장을 기다리는 사이 옷을 지워 떠난 경우는 저장할 옷이 없으므로 알리지 않는다.
         */
        if (!isMountedRef.current) {
          const isDeleted =
            error instanceof ApiError && error.code === CLOTHING_NOT_FOUND_CODE;

          if (isLatest() && !isDeleted) {
            showToast({
              tone: 'error',
              title: failureTitle,
              description: message,
            });
          }
          return;
        }

        if (isLatest()) {
          clearPending(field);
          setErrors((current) => ({ ...current, [field]: message }));
        }
      }
    });
  };

  return { pending, errors, save };
};

export default useClothingAttributeSave;
