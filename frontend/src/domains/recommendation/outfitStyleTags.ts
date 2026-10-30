import type { StyleCd } from '@/domains/member/memberSettingOptions';
import type { OutfitItemResult } from '@/generated/models';

const OUTFIT_STYLE_TAG_LIMIT = 2;

// 응답에는 아이템별 태그만 있어서, 합쳐 많이 나온 순으로 코디의 태그를 정한다. 횟수가 같으면 먼저 나온 태그가 앞선다.
export const getOutfitStyleTags = (
  items: readonly Pick<OutfitItemResult, 'style_cds'>[],
): StyleCd[] => {
  const counts = new Map<StyleCd, number>();

  items
    .flatMap((item) => item.style_cds)
    .forEach((styleCd) => {
      counts.set(styleCd, (counts.get(styleCd) ?? 0) + 1);
    });

  return [...counts.entries()]
    .sort(([, leftCount], [, rightCount]) => rightCount - leftCount)
    .slice(0, OUTFIT_STYLE_TAG_LIMIT)
    .map(([styleCd]) => styleCd);
};
