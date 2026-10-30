import { z } from 'zod';
import type { RecommendationResult } from '@/generated/models';

type LatestRegeneration = RecommendationResult['latest_regeneration'];

const regenerationFailureNoticeSchema = z.object({
  sessionId: z.number(),
  requestSeq: z.number(),
});

export const REGENERATION_REQUEST_MAX_LENGTH = 300;

export const isRegenerationProcessing = (regeneration: LatestRegeneration) =>
  regeneration?.regeneration_status_cd === 'processing';

export const isOutfitRegenerating = (
  regeneration: LatestRegeneration,
  outfitId: number,
) =>
  isRegenerationProcessing(regeneration) &&
  (regeneration?.target_scope_cd === 'all' ||
    regeneration?.target_outfit_id === outfitId);

export const isRegenerationFailureNoticed = (
  storedNotice: unknown,
  sessionId: number,
  requestSeq: number,
) => {
  const notice = regenerationFailureNoticeSchema.safeParse(storedNotice);

  return (
    notice.success &&
    notice.data.sessionId === sessionId &&
    notice.data.requestSeq === requestSeq
  );
};
