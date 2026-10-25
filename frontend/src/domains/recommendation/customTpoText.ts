import { recommendationSessionCreateTpoTextOneMax } from '@/generated/models';

export const CUSTOM_TPO_TEXT_MAX_LENGTH =
  recommendationSessionCreateTpoTextOneMax;

export const isCustomTpoTextValid = (text: string) =>
  text.trim() !== '' && [...text].length <= CUSTOM_TPO_TEXT_MAX_LENGTH;
