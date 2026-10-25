import { z } from 'zod';
import { RecommendationSessionCreate } from '@/generated/models';
import { createStartOptions } from './goingOutTime';
import type { GoingOutStart } from './goingOutTime';
import type { TpoPresetCd } from './tpoPresets';
import { TPO_PRESETS } from './tpoPresets';

const isTpoPresetCd = (value: unknown): value is TpoPresetCd =>
  TPO_PRESETS.some((preset) => preset.value === value);

const RecommendationFormDraft = z.object({
  location: z.object({
    sidoNm: z.string().min(1),
    sigunguNm: z.string().min(1),
    inputTypeCd: z.enum(['current', 'manual']),
  }),
  tpo: z.union([
    z.object({ cd: z.literal('custom'), text: z.string() }),
    z.object({ cd: z.custom<TpoPresetCd>(isTpoPresetCd) }),
  ]),
  customTpoText: z.string().nullable(),
  start: z.object({ date: z.string(), time: z.string() }),
  end: z.string(),
});

const PendingRecommendation = z.object({
  sessionId: z.int().positive(),
  requestedAt: z.number(),
  request: RecommendationSessionCreate,
  form: RecommendationFormDraft,
});

export type RecommendationFormDraft = z.infer<typeof RecommendationFormDraft>;

export type PendingRecommendation = z.input<typeof PendingRecommendation>;

export interface RestoredRecommendationForm extends Omit<
  RecommendationFormDraft,
  'start' | 'end'
> {
  start: GoingOutStart | null;
  end: string | null;
}

export const parsePendingRecommendation = (
  value: unknown,
  sessionId: number,
): PendingRecommendation | null => {
  const result = PendingRecommendation.safeParse(value);

  return result.success && result.data.sessionId === sessionId
    ? result.data
    : null;
};

export const parseRecommendationFormDraft = (
  value: unknown,
): RecommendationFormDraft | null => {
  const result = RecommendationFormDraft.safeParse(value);

  return result.success ? result.data : null;
};

export const restoreRecommendationForm = (
  draft: RecommendationFormDraft,
  now: Date,
): RestoredRecommendationForm => {
  const isStartAvailable = createStartOptions(now).some(
    (option) =>
      option.date === draft.start.date && option.time === draft.start.time,
  );

  return isStartAvailable ? draft : { ...draft, start: null, end: null };
};
