import { createFileRoute, notFound } from '@tanstack/react-router';
import { z } from 'zod';
import RecommendationProgressPage from '@/pages/RecommendationProgress';

const paramsSchema = z.object({
  sessionId: z
    .string()
    .regex(/^[1-9]\d*$/)
    .transform(Number)
    .pipe(z.int()),
});

export const Route = createFileRoute('/recommendation_/sessions/$sessionId')({
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
  component: RecommendationProgressPage,
});
