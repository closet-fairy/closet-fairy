import { createFileRoute } from '@tanstack/react-router';
import RecommendationHistoryPage from '@/pages/RecommendationHistory';

export const Route = createFileRoute('/recommendation-history')({
  component: RecommendationHistoryPage,
});
