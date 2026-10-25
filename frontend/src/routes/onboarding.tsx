import { createFileRoute } from '@tanstack/react-router';
import OnboardingPage from '@/pages/Onboarding';

export const Route = createFileRoute('/onboarding')({
  staticData: { isFullScreen: true },
  component: OnboardingPage,
});
