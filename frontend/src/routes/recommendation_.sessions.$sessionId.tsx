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
  // 다시 시도하면 같은 화면에서 세션만 바뀌므로, 이전 세션의 상태가 남지 않게 새로 그린다.
  remountDeps: ({ params }) => params.sessionId,
  staticData: { isFullScreen: true },
  component: RecommendationProgressPage,
});
