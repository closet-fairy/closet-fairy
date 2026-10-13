import { createFileRoute } from '@tanstack/react-router';
import RecommendationPage from '@/pages/Recommendation';

export const Route = createFileRoute('/recommendation')({
  component: RecommendationPage,
});
