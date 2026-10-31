import type { OutfitResult } from '@/generated/models';

export type ViewableOutfit =
  OutfitResult | OutfitResult['previous_outfits'][number];

// 맨 앞이 최신 코디이고, 뒤로 갈수록 이전 코디다.
export const getOutfitLayers = (outfit: OutfitResult): ViewableOutfit[] => [
  outfit,
  ...outfit.previous_outfits,
];

export const getRecommendationOrder = (layerCount: number, depth: number) =>
  layerCount - depth;
