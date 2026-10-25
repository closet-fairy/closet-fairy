import { createFileRoute } from '@tanstack/react-router';
import RecommendationResultPage from '@/pages/RecommendationResult';

export const Route = createFileRoute(
  '/recommendation_/sessions/$sessionId_/result',
)({
  component: RecommendationResultPage,
});
