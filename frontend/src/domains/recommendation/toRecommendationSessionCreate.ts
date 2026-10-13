import type { RecommendationSessionCreate } from '@/generated/models';
import type { TpoPresetCd } from './tpoPresets';

interface RecommendationForm {
  sidoNm: string;
  sigunguNm: string;
  tpoCd: TpoPresetCd;
  startTime: string;
  endTime: string;
}

export const toRecommendationSessionCreate = (
  form: RecommendationForm,
): RecommendationSessionCreate => {
  const { sidoNm, sigunguNm, tpoCd, startTime, endTime } = form;

  return {
    sido_nm: sidoNm,
    sigungu_nm: sigunguNm,
    location_input_type_cd: 'manual',
    tpo_cd: tpoCd,
    going_out_start_time: startTime,
    going_out_end_time: endTime,
  };
};
