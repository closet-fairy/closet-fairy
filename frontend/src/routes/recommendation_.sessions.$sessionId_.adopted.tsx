import { createFileRoute, notFound } from '@tanstack/react-router';
import { z } from 'zod';
import RecommendationAdoptedPage from '@/pages/RecommendationAdopted';

const paramsSchema = z.object({
  sessionId: z
    .string()
    .regex(/^[1-9]\d*$/)
    .transform(Number)
    .pipe(z.int()),
});

export const Route = createFileRoute(
  '/recommendation_/sessions/$sessionId_/adopted',
)({
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
  component: RecommendationAdoptedPage,
});
