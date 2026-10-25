import type { RecommendationSessionCreate } from '@/generated/models';

export interface RecommendationLocation {
  sidoNm: string;
  sigunguNm: string;
  inputTypeCd: RecommendationSessionCreate['location_input_type_cd'];
}
