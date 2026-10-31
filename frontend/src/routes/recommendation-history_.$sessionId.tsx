import { createFileRoute, notFound } from '@tanstack/react-router';
import { z } from 'zod';
import RecommendationHistoryDetailPage from '@/pages/RecommendationHistoryDetail';

const paramsSchema = z.object({
  sessionId: z
    .string()
    .regex(/^[1-9]\d*$/)
    .transform(Number)
    .pipe(z.int()),
});

export const Route = createFileRoute('/recommendation-history_/$sessionId')({
  params: {
    parse: (params) => {
      const result = paramsSchema.safeParse(params);

      if (!result.success) {
        throw notFound();
      }

      return result.data;
    },
    stringify: (params) => ({ sessionId: String(params.sessionId) }),
  },
  staticData: { isFullScreen: true },
  component: RecommendationHistoryDetailPage,
});
