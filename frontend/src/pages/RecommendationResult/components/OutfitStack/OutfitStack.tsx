import { useRef, useState } from 'react';
import type { RefObject } from 'react';
import Button from '@/components/common/Button';
import {
  getOutfitLayers,
  getRecommendationOrder,
} from '@/domains/recommendation/outfitLayers';
import type { OutfitResult } from '@/generated/models';
import OutfitCard from '@/pages/RecommendationResult/components/OutfitCard';
import useOutfitStackDrag from '@/pages/RecommendationResult/hooks/useOutfitStackDrag';
import * as S from './OutfitStack.styled';

interface OutfitStackProps {
  outfit: OutfitResult;
  depth: number;
  isRegenerating?: boolean;
  isActive?: boolean;
  onDepthChange: (depth: number) => void;
  onOverflowClick: () => void;
}

const OutfitStack = (props: OutfitStackProps) => {
  const {
    outfit,
    depth,
    isRegenerating = false,
    isActive = true,
    onDepthChange,
    onOverflowClick,
  } = props;
  const layers = getOutfitLayers(outfit);
  const hasOlder = depth < layers.length - 1;
  const hasNewer = depth > 0;
  const [playedOutfitIds, setPlayedOutfitIds] = useState<readonly number[]>([]);
  const olderButtonRef = useRef<HTMLButtonElement>(null);
  const newerButtonRef = useRef<HTMLButtonElement>(null);
  const { motion, dragHandlers } = useOutfitStackDrag({
    isEnabled: !isRegenerating,
    hasOlder,
    hasNewer,
    // 카드가 자리를 찾는 사이에 세트를 넘기거나 재추천이 끝나면 깊이가 이미 바뀌어 있을 수 있다.
    onSettle: (direction) => {
      if (direction === 'older' && hasOlder) {
        onDepthChange(depth + 1);
      } else if (direction === 'newer' && hasNewer) {
        onDepthChange(depth - 1);
      }
    },
  });

  const frontDepth = motion?.direction === 'newer' ? depth - 1 : depth;
  const backDepth = motion?.direction === 'older' ? depth + 1 : depth;

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
    <S.Stack {...dragHandlers}>
      {motion === null && hasOlder && <S.Strip />}
      {/* 끌기를 시작할 때 사진이 비지 않도록 이웃 코디도 그려 둔다. 뒤쪽 코디부터 그려야 최신 쪽이 위에 온다. */}
      {[depth + 1, depth, depth - 1].flatMap((layerDepth) => {
        if (layerDepth < 0 || layerDepth >= layers.length) {
          return [];
        }

        const layer = layers[layerDepth];
        const isFront = motion !== null && layerDepth === frontDepth;
        const isVisible =
          motion === null
            ? layerDepth === depth
            : isFront || layerDepth === backDepth;

        return (
          <S.Layer
            key={layer.outfit_id}
            $isHidden={!isVisible}
            $isSettling={isFront && motion.isSettling}
            style={
              isFront
                ? { transform: `translateY(${motion.offset}px)` }
                : undefined
            }
          >
            <OutfitCard
              items={layer.items}
              floorSeed={{ order: layer.outfit_seq, id: layer.outfit_id }}
              isRegenerating={isRegenerating && layerDepth === depth}
              isLifted={isFront}
              previousCount={
                layerDepth === 0 ? outfit.previous_outfits.length : 0
              }
              recommendationOrder={
                layerDepth > 0
                  ? getRecommendationOrder(layers.length, layerDepth)
                  : undefined
              }
              onOverflowClick={onOverflowClick}
              entrance={
                layerDepth === 0 && !playedOutfitIds.includes(layer.outfit_id)
                  ? {
                      isActive: isActive && depth === 0,
                      onPlay: () =>
                        setPlayedOutfitIds((ids) => [...ids, layer.outfit_id]),
                    }
                  : undefined
              }
            />
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
