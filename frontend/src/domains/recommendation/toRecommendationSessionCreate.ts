import type { RecommendationSessionCreate } from '@/generated/models';
import type { GoingOutDateCd } from './goingOutTime';
import type { TpoPresetCd } from './tpoPresets';

export type RecommendationTpo =
  { cd: TpoPresetCd } | { cd: 'custom'; text: string };

interface RecommendationForm {
  sidoNm: string;
  sigunguNm: string;
  tpo: RecommendationTpo;
  goingOutDateCd: GoingOutDateCd;
  startTime: string;
  endTime: string;
}

export const toRecommendationSessionCreate = (
  form: RecommendationForm,
): RecommendationSessionCreate => {
  const { sidoNm, sigunguNm, tpo, goingOutDateCd, startTime, endTime } = form;

  return {
    sido_nm: sidoNm,
    sigungu_nm: sigunguNm,
    location_input_type_cd: 'manual',
    ...(tpo.cd === 'custom'
      ? { tpo_cd: tpo.cd, tpo_text: tpo.text.trim() }
      : { tpo_cd: tpo.cd }),
    going_out_start_time: startTime,
    going_out_end_time: endTime,
    going_out_date_cd: goingOutDateCd,
  };
};
