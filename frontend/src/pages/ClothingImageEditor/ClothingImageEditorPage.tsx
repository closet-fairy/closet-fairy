import { useNavigate, useParams } from '@tanstack/react-router';
import { useState } from 'react';
import { ApiError } from '@/apis/apiError';
import Button from '@/components/common/Button';
import { useGetClothingClothingClothingIdGet } from '@/generated/endpoints/clothing/clothing';
import ClothingImageEditorLoader from '@/pages/ClothingImageEditor/components/ClothingImageEditorLoader';
import ClothingNotFoundDialog from '@/pages/ClothingImageEditor/components/ClothingNotFoundDialog';
import EditorStatusView from '@/pages/ClothingImageEditor/components/EditorStatusView';
import {
  isWebGL2Supported,
  UNSUPPORTED_MESSAGE,
} from '@/pages/ClothingImageEditor/renderer/createEditorRenderer';

const NOT_FOUND_STATUS = 404;

const LOAD_ERROR_MESSAGE = '옷 정보를 불러오지 못했어요.';

const ClothingImageEditorPage = () => {
  const { clothingId } = useParams({ from: '/closet_/$clothingId/edit' });
  const navigate = useNavigate();
  const [isSupported] = useState(isWebGL2Supported);
  const [mountedAt] = useState(Date.now);
  const clothingQuery = useGetClothingClothingClothingIdGet(clothingId, {
    query: { enabled: isSupported },
  });

  // 닫기는 확인을 이미 거쳤거나 확인이 필요 없는 경우에만 불린다.
  const close = () => {
    void navigate({ to: '/closet', ignoreBlocker: true });
  };

  if (!isSupported) {
    return <EditorStatusView title={UNSUPPORTED_MESSAGE} onClose={close} />;
  }

  const { data: clothing, error } = clothingQuery;
  /*
   * 캐시에 남은 상세는 저장 도중 실패 등으로 서버와 다를 수 있어, 들어온 뒤 새로 받은 상세로만 편집기를 연다.
   * 한 번 연 뒤에는 다시 받기가 실패해도 편집 중인 화면을 유지한다.
   */
  const hasFreshClothing =
    clothing !== undefined && clothingQuery.dataUpdatedAt >= mountedAt;

  if (hasFreshClothing) {
    if (clothing.processing_status_cd === 'processing') {
      return (
        <EditorStatusView
          title="사진을 처리하고 있어요"
          description="처리가 끝나면 편집할 수 있어요."
          onClose={close}
        />
      );
    }

    if (clothing.processing_status_cd === 'failed') {
      return (
        <EditorStatusView
          title="사진을 처리하지 못했어요"
          description={clothing.failure_reason ?? undefined}
          onClose={close}
        />
      );
    }

    return (
      <ClothingImageEditorLoader
        key={clothingId}
        clothing={clothing}
        onClose={close}
      />
    );
  }

  if (!clothingQuery.isFetchedAfterMount) {
    return <EditorStatusView title="불러오고 있어요" onClose={close} />;
  }

  if (error instanceof ApiError && error.status === NOT_FOUND_STATUS) {
    return (
      <>
        <EditorStatusView onClose={close} />
        <ClothingNotFoundDialog isOpen onConfirm={close} />
      </>
    );
  }

  if (error !== null) {
    return (
      <EditorStatusView
        title={error.message === '' ? LOAD_ERROR_MESSAGE : error.message}
        actions={
          <Button
            isFullWidth
            isDisabled={clothingQuery.isFetching}
            onClick={() => void clothingQuery.refetch()}
          >
            다시 시도
          </Button>
        }
        onClose={close}
      />
    );
  }

  return <EditorStatusView title="불러오고 있어요" onClose={close} />;
};

export default ClothingImageEditorPage;
