import { createFileRoute } from '@tanstack/react-router';
import MyInfoPage from '@/pages/MyInfo';

export const Route = createFileRoute('/my-info')({
  component: MyInfoPage,
});
