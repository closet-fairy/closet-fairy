import { useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams, useRouter } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { ApiError } from '@/apis/apiError';
import { isUnauthorizedError } from '@/apis/authSession';
import { patchClothingCard } from '@/apis/clothingListCache';
import Button from '@/components/common/Button';
import Icon from '@/components/common/Icon';
import IconButton from '@/components/common/IconButton';
import StatusView from '@/components/common/StatusView';
import { showToast } from '@/components/common/ToastProvider/ToastProvider.toast';
import TopBar from '@/components/common/TopBar';
import DeleteClothingDialog from '@/components/DeleteClothingDialog';
import {
  getGetClothingClothingClothingIdGetQueryKey,
  useGetClothingClothingClothingIdGet,
  useMarkClothingReviewedClothingClothingIdReviewedPost,
} from '@/generated/endpoints/clothing/clothing';
import type { ClothingDetail, ClothingUpdate } from '@/generated/models';
import ClothingAttributes from './components/ClothingAttributes';
import ClothingDetailSkeleton from './components/ClothingDetailSkeleton';
import ClothingNameField from './components/ClothingNameField';
import useClothingAttributeSave from './hooks/useClothingAttributeSave';
import * as S from './ClothingDetailPage.styled';

const NOT_FOUND_STATUS = 404;

// 같은 안내가 두 번 쌓이지 않도록 토스트를 하나로 묶는다.
const NOT_FOUND_TOAST_ID = 'clothing-not-found';

// 저장을 기다리는 값을 먼저 보여 준다. 분류를 악세서리가 아닌 값으로 바꾸면 BE가 종류를 비우므로 함께 비운다.
const applyPending = (
  clothing: ClothingDetail,
  pending: ClothingUpdate,
): ClothingDetail => {
  const category =
    pending.category_cd === undefined
      ? clothing.category_cd
      : pending.category_cd;

  return {
    ...clothing,
    category_cd: category,
    accessory_type_cd:
      category !== 'accessories'
        ? null
        : pending.accessory_type_cd === undefined
          ? clothing.accessory_type_cd
          : pending.accessory_type_cd,
    item_name:
      pending.item_name === undefined ? clothing.item_name : pending.item_name,
    color_cd:
      pending.color_cd === undefined ? clothing.color_cd : pending.color_cd,
    style_cds:
      pending.style_cds === undefined
        ? clothing.style_cds
        : (pending.style_cds ?? []),
    season_cds:
      pending.season_cds === undefined
        ? clothing.season_cds
        : (pending.season_cds ?? []),
    thickness_cd:
      pending.thickness_cd === undefined
        ? clothing.thickness_cd
        : pending.thickness_cd,
    is_waterproof:
      pending.is_waterproof === undefined
        ? clothing.is_waterproof
        : pending.is_waterproof,
  };
};

const ClothingDetailPage = () => {
  const { clothingId } = useParams({ from: '/closet_/$clothingId' });
  const navigate = useNavigate();
  const router = useRouter();
  const queryClient = useQueryClient();
  const clothingQuery = useGetClothingClothingClothingIdGet(clothingId);
  const { pending, errors, save } = useClothingAttributeSave(clothingId);
  const [brokenImageUrl, setBrokenImageUrl] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const reviewedIdRef = useRef<number | null>(null);
  const clothing = clothingQuery.data;
  const isNotFound =
    (clothingQuery.error instanceof ApiError &&
      clothingQuery.error.status === NOT_FOUND_STATUS) ||
    (clothing !== undefined && clothing.processing_status_cd !== 'completed');
  const isNew = clothing?.is_new === true && !isNotFound;

  const { mutate: markReviewed } =
    useMarkClothingReviewedClothingClothingIdReviewedPost({
      mutation: {
        onSuccess: (_data, variables) => {
          queryClient.setQueryData<ClothingDetail>(
            getGetClothingClothingClothingIdGetQueryKey(variables.clothingId),
            (current) => current && { ...current, is_new: false },
          );
          patchClothingCard(queryClient, variables.clothingId, {
            is_new: false,
          });
        },
      },
    });

  const goBack = () => {
    if (router.history.canGoBack()) {
      router.history.back();
      return;
    }

    void navigate({ to: '/closet', replace: true });
  };

  // 없는 옷이거나 처리가 끝나지 않은 옷이면 상세를 보여 주지 않고 옷장으로 돌려보낸다.
  useEffect(() => {
    if (isNotFound) {
      showToast({
        tone: 'info',
        title: '옷을 찾을 수 없어요',
        id: NOT_FOUND_TOAST_ID,
      });
      void navigate({ to: '/closet', replace: true });
    }
  }, [isNotFound, navigate]);

  useEffect(() => {
    if (isNew && reviewedIdRef.current !== clothingId) {
      reviewedIdRef.current = clothingId;
      markReviewed({ clothingId });
    }
  }, [clothingId, isNew, markReviewed]);

  const topBar = (
    <TopBar
      leading={
        <IconButton icon="arrow_back" aria-label="뒤로 가기" onClick={goBack} />
      }
    />
  );

  if (
    clothing === undefined ||
    isNotFound ||
    isUnauthorizedError(clothingQuery.error)
  ) {
    if (
      clothingQuery.isError &&
      !isNotFound &&
      !isUnauthorizedError(clothingQuery.error)
    ) {
      return (
        <S.Container>
          {topBar}
          <StatusView
            visual={<Icon name="error" size="xl" />}
            title="옷을 불러오지 못했어요"
            description={clothingQuery.error.message}
            actions={
              <Button
                icon="refresh"
                isFullWidth
                isLoading={clothingQuery.isFetching}
                onClick={() => void clothingQuery.refetch()}
              >
                다시 시도
              </Button>
            }
          />
        </S.Container>
      );
    }

    return (
      <S.Container>
        {topBar}
        <S.Content>
          <ClothingDetailSkeleton />
        </S.Content>
        <S.LoadingMessage role="status">
          옷을 불러오는 중이에요
        </S.LoadingMessage>
      </S.Container>
    );
  }

  const shownClothing = applyPending(clothing, pending);

  return (
    <S.Container>
      {topBar}
      <S.Content>
        <S.ImageBox>
          {brokenImageUrl === clothing.image_url ? (
            <S.ImagePlaceholder>
              <Icon name="image" size="xl" label="사진을 불러오지 못했어요" />
            </S.ImagePlaceholder>
          ) : (
            <S.Image
              src={clothing.image_url}
              alt=""
              onError={() => setBrokenImageUrl(clothing.image_url)}
            />
          )}
          <S.EditImage>
            <Button
              variant="outline"
              size="sm"
              icon="edit"
              onClick={() =>
                void navigate({
                  to: '/closet/$clothingId/edit',
                  params: { clothingId },
                })
              }
            >
              이미지 편집
            </Button>
          </S.EditImage>
        </S.ImageBox>
        <ClothingNameField
          key={clothing.clothing_id}
          name={shownClothing.item_name}
          errorMessage={errors.item_name}
          onSave={(name) =>
            save('item_name', { item_name: name }, '이름을 저장하지 못했어요')
          }
        />
        <ClothingAttributes
          clothing={shownClothing}
          errors={errors}
          onSave={save}
        />
        <S.DeleteArea>
          <Button
            variant="text"
            size="md"
            icon="delete"
            aria-haspopup="dialog"
            onClick={() => setIsDeleteDialogOpen(true)}
          >
            이 옷 삭제
          </Button>
        </S.DeleteArea>
      </S.Content>
      <DeleteClothingDialog
        clothingId={clothingId}
        isOpen={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        // 지운 옷의 상세로 뒤로 가기가 돌아오지 않도록 기록을 바꿔치기한다.
        onDeleted={() => {
          setIsDeleteDialogOpen(false);
          void navigate({ to: '/closet', replace: true });
        }}
      />
    </S.Container>
  );
};

export default ClothingDetailPage;
