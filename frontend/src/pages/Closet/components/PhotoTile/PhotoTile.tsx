import { useState } from 'react';
import Icon from '@/components/common/Icon';
import type { PhotoTileState } from '@/pages/Closet/types';
import * as S from './PhotoTile.styled';

interface PhotoTileProps {
  fileName: string;
  previewUrl: string;
  state: PhotoTileState;
  onToggle: () => void;
}

const STATE_LABEL: Record<PhotoTileState, string | null> = {
  selected: null,
  discarded: '버림',
  locked: '더 고를 수 없어요',
};

const PhotoTile = (props: PhotoTileProps) => {
  const { fileName, previewUrl, state, onToggle } = props;
  // HEIC처럼 브라우저가 그리지 못하는 사진은 아이콘과 파일 이름으로 대신한다.
  const [isPreviewBroken, setIsPreviewBroken] = useState(false);
  const label = STATE_LABEL[state];

  return (
    <S.Tile
      type="button"
      aria-label={fileName}
      aria-pressed={state === 'selected'}
      disabled={state === 'locked'}
      $state={state}
      onClick={onToggle}
    >
      <S.Preview $state={state}>
        {isPreviewBroken ? (
          <S.Placeholder>
            <Icon name="image" size="lg" />
            <S.FileName>{fileName}</S.FileName>
          </S.Placeholder>
        ) : (
          <S.Image
            src={previewUrl}
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => setIsPreviewBroken(true)}
          />
        )}
      </S.Preview>
      {state !== 'locked' && (
        <S.CheckMark $isChecked={state === 'selected'}>
          {state === 'selected' && <Icon name="check" size="sm" />}
        </S.CheckMark>
      )}
      {label !== null && <S.StateLabel>{label}</S.StateLabel>}
    </S.Tile>
  );
};

export default PhotoTile;
