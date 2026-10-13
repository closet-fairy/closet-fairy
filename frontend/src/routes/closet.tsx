import { createFileRoute } from '@tanstack/react-router';
import ClosetPage from '@/pages/Closet';

export const Route = createFileRoute('/closet')({
  component: ClosetPage,
});
