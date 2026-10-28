import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { ApiError } from '@/apis/apiError';
import { isUnauthorizedError } from '@/apis/authSession';
import { showToast } from '@/components/common/ToastProvider/ToastProvider.toast';
import {
  getGetClothingClothingClothingIdGetQueryKey,
  updateClothingClothingClothingIdPatch,
} from '@/generated/endpoints/clothing/clothing';
import type { ClothingUpdate } from '@/generated/models';

export type AttributeField = keyof ClothingUpdate;

const UNKNOWN_SAVE_ERROR = '저장하지 못했어요.';

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

    queueRef.current = queueRef.current.then(async () => {
      try {
        const updated = await updateClothingClothingClothingIdPatch(
          clothingId,
          update,
        );
        queryClient.setQueryData(
          getGetClothingClothingClothingIdGetQueryKey(clothingId),
          updated,
        );

        if (isLatest()) {
          clearPending(field);
          setErrors((current) => ({ ...current, [field]: undefined }));
        }
      } catch (error) {
        // 로그인 만료는 전역 다이얼로그가 안내한다.
        if (isUnauthorizedError(error)) {
          return;
        }

        const message =
          error instanceof ApiError ? error.message : UNKNOWN_SAVE_ERROR;

        // 응답이 오기 전에 상세를 떠났다면 행 아래 문구를 볼 수 없으므로 토스트로 알린다.
        if (!isMountedRef.current) {
          showToast({
            tone: 'error',
            title: failureTitle,
            description: message,
          });
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
