import type { IconName } from '@/assets/icons';
import Icon from '@/components/common/Icon';
import Tag from '@/components/common/Tag';
import type { ClothingArea } from '@/domains/recommendation/clothingArea';
import { getFloorCandidates } from '@/domains/recommendation/floorCandidates';
import { layoutFloor } from '@/domains/recommendation/floorLayout';
import type {
  FloorItem,
  FloorLayout,
  FloorPlacement,
  FloorSeed,
} from '@/domains/recommendation/floorLayout';
import { FLOOR_CARD } from '@/domains/recommendation/floorLayout.constants';
import type { OutfitItemResult } from '@/generated/models';
import useFloorImages from '@/hooks/useFloorImages';
import * as S from './OutfitFloor.styled';

export type OutfitFloorVariant = 'card' | 'floor';

interface OutfitFloorProps {
  items: readonly OutfitItemResult[];
  seed: FloorSeed;
  variant?: OutfitFloorVariant;
  hasTagStrip?: boolean;
  isOverflowDisabled?: boolean;
  onOverflowClick?: () => void;
}

const floorLayouts = new Map<string, FloorLayout>();

// 옷이 많으면 계산이 오래 걸려서, 카드가 다시 그려져도 같은 코디는 다시 계산하지 않는다.
const getFloorLayout = (items: readonly FloorItem[], seed: FloorSeed) => {
  const key = JSON.stringify([seed, items]);
  const layout = floorLayouts.get(key) ?? layoutFloor(items, seed);

  floorLayouts.set(key, layout);

  return layout;
};

const toPercent = (value: number) => `${value * 100}%`;

const getItemStyle = (placement: FloorPlacement) => ({
  left: toPercent(placement.x / FLOOR_CARD.width),
  top: toPercent(placement.y / FLOOR_CARD.height),
  width: toPercent(placement.width / FLOOR_CARD.width),
  height: toPercent(placement.height / FLOOR_CARD.height),
  transform: `rotate(${placement.rotation}deg)`,
  zIndex: placement.stackOrder,
});

const getImageStyle = (area: ClothingArea) => ({
  left: toPercent(-area.left / area.width),
  top: toPercent(-area.top / area.height),
  width: toPercent(1 / area.width),
  height: toPercent(1 / area.height),
});

const EMPTY_NOTICE: Record<
  'noImage' | 'loadFailed',
  { icon: IconName; title: string }
> = {
  noImage: { icon: 'image', title: '이 코디는 미리보기를 지원하지 않아요' },
  loadFailed: { icon: 'hide_image', title: '사진을 불러오지 못했어요' },
};

const OutfitFloor = (props: OutfitFloorProps) => {
  const {
    items,
    seed,
    variant = 'card',
    hasTagStrip = true,
    isOverflowDisabled = false,
    onOverflowClick,
  } = props;
  const candidates = getFloorCandidates(items);
  const { isSettled, isSlow, getLoadedArea, markLoaded, markFailed } =
    useFloorImages(candidates.map(({ imageUrl }) => imageUrl));

  const { placements, overflowCount } = getFloorLayout(
    isSettled
      ? candidates.flatMap(({ id, kind, imageUrl }) => {
          const area = getLoadedArea(imageUrl);

          return area !== null ? [{ id, kind, ratio: area.ratio }] : [];
        })
      : [],
    seed,
  );

  if (isSettled && placements.length === 0) {
    const notice =
      EMPTY_NOTICE[candidates.length > 0 ? 'loadFailed' : 'noImage'];

    return (
      <S.Empty>
        <S.EmptyIcon>
          <Icon name={notice.icon} size="xl" />
        </S.EmptyIcon>
        <S.EmptyTitle>{notice.title}</S.EmptyTitle>
        {variant === 'card' && (
          <S.EmptyDescription>
            정보 확인에서 아이템을 볼 수 있어요.
          </S.EmptyDescription>
        )}
      </S.Empty>
    );
  }

  const placementsById = new Map(
    placements.map((placement) => [placement.id, placement]),
  );

  return (
    <>
      {!isSettled && isSlow && (
        <S.Waiting role="status">
          <Icon name="progress_activity" size="lg" />
        </S.Waiting>
      )}
      <S.Stage $variant={variant} $hasTagStrip={hasTagStrip}>
        {/* 결과를 받으려고 먼저 그려 두고, 정해지면 놓을 옷만 남겨 같은 사진을 다시 불러오지 않게 한다. */}
        {candidates
          .filter(({ id }) => !isSettled || placementsById.has(id))
          .map(({ id, name, imageUrl }) => {
            const placement = placementsById.get(id);
            const area = getLoadedArea(imageUrl);

            return (
              <S.Item
                key={`${id}-${imageUrl}`}
                $isHidden={!isSettled}
                style={placement ? getItemStyle(placement) : undefined}
              >
                <S.Image
                  src={imageUrl}
                  alt={name}
                  draggable={false}
                  style={area ? getImageStyle(area) : undefined}
                  onLoad={({ currentTarget }) =>
                    markLoaded(imageUrl, currentTarget)
                  }
                  onError={() => markFailed(imageUrl)}
                />
              </S.Item>
            );
          })}
      </S.Stage>
      {overflowCount > 0 && onOverflowClick && (
        <S.OverflowButton
          type="button"
          aria-label={`넘친 아이템 ${overflowCount}개 보기`}
          disabled={isOverflowDisabled}
          onClick={onOverflowClick}
        >
          <Tag variant="white" size="sm">
            +{overflowCount}
          </Tag>
        </S.OverflowButton>
      )}
    </>
  );
};

export default OutfitFloor;
