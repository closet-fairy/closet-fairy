import { useRef, useState } from 'react';
import type { RefObject } from 'react';
import Button from '@/components/common/Button';
import Tag from '@/components/common/Tag';
import {
  getOutfitLayers,
  getRecommendationOrder,
} from '@/domains/recommendation/outfitLayers';
import type { OutfitResult } from '@/generated/models';
import OutfitCard from '@/pages/RecommendationResult/components/OutfitCard';
import useOutfitPager from '@/pages/RecommendationResult/hooks/useOutfitPager';
import * as S from './OutfitStack.styled';

interface OutfitStackProps {
  outfit: OutfitResult;
  depth: number;
  isRegenerating?: boolean;
  isActive?: boolean;
  onDepthChange: (depth: number) => void;
  onPresenceChange?: (presence: number) => void;
  onOverflowClick: () => void;
}

const OutfitStack = (props: OutfitStackProps) => {
  const {
    outfit,
    depth,
    isRegenerating = false,
    isActive = true,
    onDepthChange,
    onPresenceChange,
    onOverflowClick,
  } = props;
  const layers = getOutfitLayers(outfit);
  const hasOlder = depth < layers.length - 1;
  const hasNewer = depth > 0;
  const [playedOutfitIds, setPlayedOutfitIds] = useState<readonly number[]>([]);
  const olderButtonRef = useRef<HTMLButtonElement>(null);
  const newerButtonRef = useRef<HTMLButtonElement>(null);
  const { stackRef, registerLayerAt, nearest, range, dragHandlers } =
    useOutfitPager({
      layerCount: layers.length,
      depth,
      isEnabled: !isRegenerating && isActive,
      onDepthChange,
      onPresenceChange,
    });
  const [low, high] = range;

  // 끝에 닿으면 누른 버튼이 사라져 포커스를 잃으므로, 다시 그려진 다음 프레임에 반대쪽 버튼으로 옮긴다.
  const moveByButton = (
    nextDepth: number,
    isReachingEnd: boolean,
    oppositeButtonRef: RefObject<HTMLButtonElement | null>,
  ) => {
    onDepthChange(nextDepth);

    if (isReachingEnd) {
      requestAnimationFrame(() => {
        oppositeButtonRef.current?.focus();
      });
    }
  };

  return (
    <S.Stack ref={stackRef} {...dragHandlers}>
      {layers.length > 1 && (
        <S.OrderBadge aria-hidden>
          <Tag variant="white" size="sm" icon="layers">
            {getRecommendationOrder(layers.length, nearest)}번째 추천 ·{' '}
            {layers.length}장
          </Tag>
        </S.OrderBadge>
      )}
      {layers.map((layer, layerDepth) => {
        if (layerDepth < low || layerDepth > high) {
          return null;
        }

        const isCurrent = layerDepth === depth;
        const hasOrderLabel = isCurrent && layers.length > 1;

        return (
          <S.Layer
            key={layer.outfit_id}
            ref={registerLayerAt(layerDepth)}
            role={hasOrderLabel ? 'group' : undefined}
            aria-label={
              hasOrderLabel
                ? `${getRecommendationOrder(layers.length, layerDepth)}번째 추천, 전체 ${layers.length}장`
                : undefined
            }
            aria-hidden={!isCurrent}
            inert={!isCurrent}
          >
            <S.Surface />
            <S.Content>
              <OutfitCard
                items={layer.items}
                floorSeed={{ order: layer.outfit_seq, id: layer.outfit_id }}
                isRegenerating={isRegenerating && layerDepth === depth}
                onOverflowClick={onOverflowClick}
                entrance={
                  layerDepth === 0 && !playedOutfitIds.includes(layer.outfit_id)
                    ? {
                        isActive: isActive && depth === 0,
                        onPlay: () =>
                          setPlayedOutfitIds((ids) => [
                            ...ids,
                            layer.outfit_id,
                          ]),
                      }
                    : undefined
                }
              />
            </S.Content>
          </S.Layer>
        );
      })}
      {!isRegenerating && hasOlder && (
        <S.HistoryButton>
          <Button
            ref={olderButtonRef}
            variant="outline"
            size="sm"
            onClick={() => {
              moveByButton(
                depth + 1,
                depth + 1 === layers.length - 1,
                newerButtonRef,
              );
            }}
          >
            이전 코디 보기
          </Button>
        </S.HistoryButton>
      )}
      {!isRegenerating && hasNewer && (
        <S.HistoryButton>
          <Button
            ref={newerButtonRef}
            variant="outline"
            size="sm"
            onClick={() => {
              moveByButton(depth - 1, depth === 1, olderButtonRef);
            }}
          >
            최신 쪽으로 돌아가기
          </Button>
        </S.HistoryButton>
      )}
    </S.Stack>
  );
};

export default OutfitStack;
