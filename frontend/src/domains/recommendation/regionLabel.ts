const SIDO_SHORT_NAMES: Readonly<Partial<Record<string, string>>> = {
  서울특별시: '서울',
  부산광역시: '부산',
  대구광역시: '대구',
  인천광역시: '인천',
  광주광역시: '광주',
  대전광역시: '대전',
  울산광역시: '울산',
  세종특별자치시: '세종',
  경기도: '경기',
  강원특별자치도: '강원',
  충청북도: '충북',
  충청남도: '충남',
  전북특별자치도: '전북',
  전라남도: '전남',
  경상북도: '경북',
  경상남도: '경남',
  제주특별자치도: '제주',
};

export const getSidoShortName = (sidoNm: string) =>
  SIDO_SHORT_NAMES[sidoNm] ?? sidoNm;

export const formatRegionLabel = (sidoNm: string, sigunguNm: string) => {
  const sidoShortName = getSidoShortName(sidoNm);

  if (sigunguNm === sidoNm) {
    return sidoShortName;
  }

  return `${sidoShortName} ${sigunguNm}`;
};

export const formatRegionFullName = (sidoNm: string, sigunguNm: string) => {
  if (sigunguNm === sidoNm) {
    return sidoNm;
  }

  return `${sidoNm} ${sigunguNm}`;
};
