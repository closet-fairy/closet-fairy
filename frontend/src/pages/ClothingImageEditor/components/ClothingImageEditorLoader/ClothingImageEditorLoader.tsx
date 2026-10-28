import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { ApiError } from '@/apis/apiError';
import { isUnauthorizedError } from '@/apis/authSession';
import Button from '@/components/common/Button';
import type { ClothingDetail } from '@/generated/models';
import ClothingNotFoundDialog from '@/pages/ClothingImageEditor/components/ClothingNotFoundDialog';
import EditorStatusView from '@/pages/ClothingImageEditor/components/EditorStatusView';
import ImageEditor from '@/pages/ClothingImageEditor/components/ImageEditor';
import useSaveClothingImageEdit from '@/pages/ClothingImageEditor/hooks/useSaveClothingImageEdit';
import { parseSavedEdit } from '@/pages/ClothingImageEditor/parseSavedEdit';
import {
  EditorSourcesError,
  loadEditorSources,
} from '@/pages/ClothingImageEditor/renderer/loadEditorSources';

interface ClothingImageEditorLoaderProps {
  clothing: ClothingDetail;
  onClose: () => void;
  onNotFound: () => void;
}

const LOAD_ERROR_MESSAGE = '이미지를 불러오지 못했어요.';

const getLoadErrorMessage = (error: unknown) =>
  (error instanceof EditorSourcesError || error instanceof ApiError) &&
  error.message !== ''
    ? error.message
    : LOAD_ERROR_MESSAGE;

const ClothingImageEditorLoader = (props: ClothingImageEditorLoaderProps) => {
  const { clothing, onClose, onNotFound } = props;
  // 저장 응답으로 상세 캐시가 바뀌어도 편집 중인 그림을 다시 불러오지 않도록, 처음 받은 옷으로 편집기를 연다.
  const [initialClothing] = useState(clothing);
  const clothingId = initialClothing.clothing_id;
  const originUrl = initialClothing.origin_image_url;
  const cutoutUrl = initialClothing.cutout_image_url;
  const maskUrl = initialClothing.edit?.brush_mask_url ?? null;
  const sourcesQuery = useQuery({
    queryKey: [
      'clothingImageEditorSources',
      clothingId,
      originUrl,
      cutoutUrl,
      maskUrl,
    ],
    queryFn: () => loadEditorSources({ originUrl, cutoutUrl, maskUrl }),
    staleTime: Infinity,
    gcTime: 0,
    retry: false,
  });
  const { save, isSaving, errorMessage, isNotFound, hasUnsavedServerChange } =
    useSaveClothingImageEdit(clothingId);

  if (sourcesQuery.isPending || isUnauthorizedError(sourcesQuery.error)) {
    return <EditorStatusView title="불러오고 있어요" onClose={onClose} />;
  }

  if (sourcesQuery.isError) {
    return (
      <EditorStatusView
        title={getLoadErrorMessage(sourcesQuery.error)}
        actions={
          <Button
            isFullWidth
            isDisabled={sourcesQuery.isFetching}
            onClick={() => void sourcesQuery.refetch()}
          >
            다시 시도
          </Button>
        }
        onClose={onClose}
      />
    );
  }

  const sources = sourcesQuery.data;
  const { initialEdit, hasInvalidSavedEdit } = parseSavedEdit(
    initialClothing.edit,
    sources.size,
  );

  return (
    <>
      <ImageEditor
        sources={sources}
        initialEdit={initialEdit}
        isSaving={isSaving}
        saveErrorMessage={errorMessage}
        hasUnsavedServerChange={hasUnsavedServerChange}
        onSave={(result) =>
          save(result, {
            sources,
            hasSavedMask: maskUrl !== null,
            hasInvalidSavedEdit,
          })
        }
        onClose={onClose}
      />
      <ClothingNotFoundDialog isOpen={isNotFound} onConfirm={onNotFound} />
    </>
  );
};

export default ClothingImageEditorLoader;
