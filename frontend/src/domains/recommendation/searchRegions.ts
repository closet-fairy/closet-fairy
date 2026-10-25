import type { SidoRegions } from '@/generated/models';
import { formatRegionFullName, getSidoShortName } from './regionLabel';

export interface RegionSearchResult {
  sidoNm: string;
  sigunguNm: string;
  fullName: string;
}

const SIDO_SUFFIX_ALIASES = [
  { suffix: '특별자치시', alias: '시' },
  { suffix: '특별시', alias: '시' },
  { suffix: '광역시', alias: '시' },
  { suffix: '특별자치도', alias: '도' },
] as const;

const SEARCH_TARGET_SEPARATOR = '|';

const removeWhitespace = (text: string) => text.replace(/\s/g, '');

const getSidoAliases = (sidoNm: string) => {
  const shortName = getSidoShortName(sidoNm);
  const suffixAlias = SIDO_SUFFIX_ALIASES.find(({ suffix }) =>
    sidoNm.endsWith(suffix),
  );

  return [
    sidoNm,
    shortName,
    ...(suffixAlias ? [`${shortName}${suffixAlias.alias}`] : []),
  ];
};

const createSearchTarget = (sidoNm: string, sigunguNm: string) =>
  getSidoAliases(sidoNm)
    .map((sidoAlias) => removeWhitespace(`${sidoAlias}${sigunguNm}`))
    .join(SEARCH_TARGET_SEPARATOR);

export const searchRegions = (
  regions: readonly SidoRegions[],
  query: string,
): RegionSearchResult[] => {
  const queryTokens = query
    .normalize('NFC')
    .split(/\s+/)
    .filter((token) => token !== '');

  if (queryTokens.length === 0) {
    return [];
  }

  return regions.flatMap((region) => {
    const { sido_nm: sidoNm, sigungu_nms: sigunguNms } = region;

    return sigunguNms
      .filter((sigunguNm) => {
        const searchTarget = createSearchTarget(sidoNm, sigunguNm);

        return queryTokens.every((token) => searchTarget.includes(token));
      })
      .map((sigunguNm) => ({
        sidoNm,
        sigunguNm,
        fullName: formatRegionFullName(sidoNm, sigunguNm),
      }));
  });
};
